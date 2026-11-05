import { Injectable, Injector, computed, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom, timeout } from 'rxjs';

import { environment } from '../../../environments/environment';

export type Rol = 'trabajador' | 'mayordomo' | 'admin';

export interface Usuario {
  id: number;
  nombre: string;
  email: string;
  rol: Rol;
  rol_etiqueta: string;
}

/** token null = sesión abierta sin conexión: falta pedir un token a Laravel al volver la red. */
interface Sesion {
  token: string | null;
  usuario: Usuario;
}

/**
 * Lo que se guarda para poder entrar sin internet: el usuario y una "huella" de la
 * contraseña (PBKDF2). La huella no se puede revertir a la contraseña.
 */
interface CredencialOffline {
  usuario: Usuario;
  sal: string;
  huella: string;
  guardadaEn: string;     // último login con internet
  fallos: number;
  bloqueadaHasta: number; // ms; tras varios intentos fallidos sin red
}

/** Error de login con un mensaje listo para mostrar. */
export class ErrorLogin extends Error {}

const CLAVE = 'obrasync.sesion';
const CLAVE_OFFLINE = 'obrasync.offline';

/** Sin conectarse en este tiempo, el login sin internet deja de valer (igual que el token). */
const DIAS_VIGENCIA_OFFLINE = 30;
/** Iteraciones de PBKDF2: hacen lento adivinar la contraseña a partir de la huella. */
const ITERACIONES = 210_000;
const MAX_FALLOS = 5;
const BLOQUEO_MS = 5 * 60_000;

/**
 * Sesión del usuario.
 * - Primera vez: el login necesita internet (Laravel valida la contraseña y entrega un token).
 * - Después: se puede entrar sin internet con el mismo correo y contraseña; se compara contra
 *   la huella guardada en este dispositivo. Al volver la red se pide un token nuevo a Laravel.
 *
 * Nota: se guarda en localStorage por simplicidad. En la versión nativa conviene un
 * almacenamiento seguro (Keychain/Keystore); como todo pasa por esta clase, solo cambia aquí.
 */
@Injectable({ providedIn: 'root' })
export class Auth {

  private http = inject(HttpClient);
  private injector = inject(Injector); // el Router se pide solo al usarlo (Auth se crea durante el arranque)
  private sesion = signal<Sesion | null>(this.leer());

  /** Contraseña del login sin internet, SOLO en memoria, para renovar el token al volver la red. */
  private pendiente: { email: string; password: string } | null = null;
  private renovando: Promise<boolean> | null = null;

  readonly usuario = computed(() => this.sesion()?.usuario ?? null);
  readonly autenticado = computed(() => this.sesion() !== null);
  /** Entró sin internet y aún no tiene token: sus registros esperan a que vuelva la red. */
  readonly sinToken = computed(() => !!this.sesion() && !this.sesion()!.token);
  /** Mensaje para la pantalla de login (p. ej. cuando hay que volver a escribir la contraseña). */
  readonly avisoLogin = signal<{ email: string; mensaje: string } | null>(null);

  get token(): string | null {
    return this.sesion()?.token ?? null;
  }

  /**
   * Inicia sesión. Con internet, contra Laravel; sin internet (o si el servidor no responde),
   * contra la huella guardada del último login en este dispositivo.
   */
  async iniciarSesion(email: string, password: string): Promise<Usuario> {
    const correo = email.trim().toLowerCase();

    if (!navigator.onLine) {
      return this.entrarSinConexion(correo, password);
    }

    try {
      const respuesta = await this.pedirToken(correo, password);
      this.guardar(respuesta);
      await this.recordar(correo, password, respuesta.usuario);
      return respuesta.usuario;
    } catch (e) {
      // Hay "red" pero el servidor no contesta: si esta cuenta ya entró aquí, se entra sin conexión.
      if (this.esFallaDeRed(e) && this.credenciales()[correo]) {
        return this.entrarSinConexion(correo, password);
      }
      throw this.traducirError(e);
    }
  }

  /**
   * Pide un token nuevo a Laravel para una sesión abierta sin internet.
   * La usa el sincronizador antes de enviar. Devuelve true si ya hay token.
   */
  reautenticar(): Promise<boolean> {
    if (this.token) return Promise.resolve(true);
    // Si ya se está renovando, todos esperan la misma petición (no dos logins a la vez).
    this.renovando ??= this.renovar().finally(() => (this.renovando = null));
    return this.renovando;
  }

  /** Cierra sesión: revoca el token en Laravel (si hay red) y lo borra del dispositivo. */
  async cerrarSesion() {
    if (navigator.onLine && this.token) {
      try {
        await firstValueFrom(this.http.post(`${environment.apiUrl}/logout`, {}).pipe(timeout(5_000)));
      } catch {
        // Si falla, igual se cierra localmente; el token expira solo a los 30 días.
      }
    }
    // La huella se conserva: permite volver a entrar sin internet con la contraseña.
    this.limpiar();
  }

  /** Actualiza nombre/rol desde Laravel (si cambió en la oficina). Sin red no hace nada. */
  async refrescarUsuario() {
    if (!navigator.onLine || !this.token) return;
    try {
      const r = await firstValueFrom(
        this.http.get<{ data: Usuario }>(`${environment.apiUrl}/me`).pipe(timeout(8_000))
      );
      this.guardar({ token: this.token, usuario: r.data });
    } catch {
      // 401 lo maneja el interceptor (cierra la sesión); otros errores se ignoran (se reintenta luego).
    }
  }

  /** Borra la sesión local (también lo usa el interceptor cuando el token ya no sirve). */
  limpiar() {
    this.pendiente = null;
    localStorage.removeItem(CLAVE);
    this.sesion.set(null);
  }

  // ---------------------------------------------------------- login sin internet

  private async entrarSinConexion(correo: string, password: string): Promise<Usuario> {
    const todas = this.credenciales();
    const cred = todas[correo];

    if (!cred || !crypto.subtle) {
      throw new ErrorLogin('Sin conexión solo puedes entrar con una cuenta que ya inició sesión en este dispositivo.');
    }
    if (Date.now() - new Date(cred.guardadaEn).getTime() > DIAS_VIGENCIA_OFFLINE * 86_400_000) {
      throw new ErrorLogin(`Hace más de ${DIAS_VIGENCIA_OFFLINE} días que no te conectas. Necesitas internet para entrar.`);
    }
    if (cred.bloqueadaHasta > Date.now()) {
      throw new ErrorLogin('Demasiados intentos. Espera unos minutos o conéctate a internet.');
    }

    if (await this.huella(password, cred.sal) !== cred.huella) {
      cred.fallos += 1;
      if (cred.fallos >= MAX_FALLOS) {
        cred.fallos = 0;
        cred.bloqueadaHasta = Date.now() + BLOQUEO_MS;
      }
      this.guardarCredenciales(todas);
      throw new ErrorLogin('Correo o contraseña incorrectos.');
    }

    cred.fallos = 0;
    this.guardarCredenciales(todas);
    this.pendiente = { email: correo, password };
    this.guardar({ token: null, usuario: cred.usuario });
    return cred.usuario;
  }

  /** Tras un login con internet, guarda la huella para poder entrar sin internet después. */
  private async recordar(correo: string, password: string, usuario: Usuario) {
    if (!crypto.subtle) return; // sin Web Crypto (contexto no seguro) no hay login offline
    const sal = this.base64(crypto.getRandomValues(new Uint8Array(16)));
    const todas = this.credenciales();
    todas[correo] = {
      usuario,
      sal,
      huella: await this.huella(password, sal),
      guardadaEn: new Date().toISOString(),
      fallos: 0,
      bloqueadaHasta: 0,
    };
    this.guardarCredenciales(todas);
  }

  /** PBKDF2-SHA256 de la contraseña con la sal de este dispositivo. */
  private async huella(password: string, sal: string): Promise<string> {
    const clave = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', hash: 'SHA-256', salt: Uint8Array.from(atob(sal), c => c.charCodeAt(0)), iterations: ITERACIONES },
      clave,
      256
    );
    return this.base64(new Uint8Array(bits));
  }

  private async renovar(): Promise<boolean> {
    if (!navigator.onLine || !this.sesion()) return false;

    const p = this.pendiente;
    if (!p) {
      // La app se reinició y la contraseña ya no está en memoria: hay que volver a escribirla.
      this.pedirContrasena('Vuelve a escribir tu contraseña para enviar lo que registraste sin conexión.');
      return false;
    }

    try {
      const respuesta = await this.pedirToken(p.email, p.password);
      this.guardar(respuesta);
      await this.recordar(p.email, p.password, respuesta.usuario);
      this.pendiente = null;
      return true;
    } catch (e) {
      if (this.esFallaDeRed(e)) return false; // el servidor no contesta: se reintenta después
      // La contraseña cambió o la cuenta se desactivó: hay que entrar de nuevo con internet.
      this.pedirContrasena(this.traducirError(e).message);
      return false;
    }
  }

  /** Manda al login con el correo ya escrito. Lo registrado sin conexión sigue guardado y se envía al entrar. */
  private pedirContrasena(mensaje: string) {
    const email = this.usuario()?.email ?? '';
    this.limpiar();
    this.avisoLogin.set({ email, mensaje });
    this.injector.get(Router).navigateByUrl('/login', { replaceUrl: true });
  }

  // ---------------------------------------------------------- utilidades

  private pedirToken(email: string, password: string): Promise<{ token: string; usuario: Usuario }> {
    return firstValueFrom(
      this.http
        .post<{ token: string; usuario: Usuario }>(`${environment.apiUrl}/login`, {
          email,
          password,
          dispositivo: this.nombreDispositivo(),
        })
        .pipe(timeout(10_000))
    );
  }

  /** Sin respuesta del servidor (sin red, servidor apagado o tardó demasiado). */
  private esFallaDeRed(e: unknown): boolean {
    return (e instanceof HttpErrorResponse && e.status === 0) || (e instanceof Error && e.name === 'TimeoutError');
  }

  private guardar(sesion: Sesion) {
    localStorage.setItem(CLAVE, JSON.stringify(sesion));
    this.sesion.set(sesion);
  }

  private leer(): Sesion | null {
    try {
      const valor = localStorage.getItem(CLAVE);
      return valor ? (JSON.parse(valor) as Sesion) : null;
    } catch {
      return null;
    }
  }

  private credenciales(): Record<string, CredencialOffline> {
    try {
      return JSON.parse(localStorage.getItem(CLAVE_OFFLINE) ?? '{}');
    } catch {
      return {};
    }
  }

  private guardarCredenciales(todas: Record<string, CredencialOffline>) {
    localStorage.setItem(CLAVE_OFFLINE, JSON.stringify(todas));
  }

  private base64(bytes: Uint8Array): string {
    return btoa(String.fromCharCode(...bytes));
  }

  /** Nombre corto del dispositivo para identificar la sesión en Laravel (p. ej. "Chrome · Windows"). */
  private nombreDispositivo(): string {
    const ua = navigator.userAgent;
    const navegador = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Navegador';
    const sistema = /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Windows/.test(ua) ? 'Windows' : /Mac OS/.test(ua) ? 'macOS' : 'Linux';
    return `${navegador} · ${sistema}`;
  }

  private traducirError(e: unknown): ErrorLogin {
    if (e instanceof HttpErrorResponse) {
      switch (e.status) {
        case 0:
          return new ErrorLogin('No pudimos conectar con el servidor. Revisa tu conexión.');
        case 403:
          return new ErrorLogin(e.error?.message ?? 'Tu cuenta está desactivada.');
        case 422:
          return new ErrorLogin(e.error?.errors?.email?.[0] ?? 'Revisa tu correo y contraseña.');
        case 429:
          return new ErrorLogin('Demasiados intentos. Espera un minuto e intenta de nuevo.');
      }
      if (e.status >= 500) return new ErrorLogin('El servidor tuvo un problema. Intenta más tarde.');
    }
    if (e instanceof Error && e.name === 'TimeoutError') {
      return new ErrorLogin('El servidor tardó demasiado en responder.');
    }
    return new ErrorLogin('No se pudo iniciar sesión. Intenta de nuevo.');
  }
}
