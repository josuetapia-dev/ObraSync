import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
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

interface Sesion {
  token: string;
  usuario: Usuario;
}

/** Error de login con un mensaje listo para mostrar. */
export class ErrorLogin extends Error {}

const CLAVE = 'obrasync.sesion';

/**
 * Sesión del usuario.
 * - El login necesita internet (Laravel valida la contraseña y entrega un token).
 * - Después la sesión queda guardada en el dispositivo: la app abre y funciona sin señal.
 *
 * Nota: se guarda en localStorage por simplicidad. En la versión nativa conviene un
 * almacenamiento seguro (Keychain/Keystore); como todo pasa por esta clase, solo cambia aquí.
 */
@Injectable({ providedIn: 'root' })
export class Auth {

  private http = inject(HttpClient);
  private sesion = signal<Sesion | null>(this.leer());

  readonly usuario = computed(() => this.sesion()?.usuario ?? null);
  readonly autenticado = computed(() => this.sesion() !== null);

  get token(): string | null {
    return this.sesion()?.token ?? null;
  }

  /** Inicia sesión contra Laravel y guarda el token en el dispositivo. */
  async iniciarSesion(email: string, password: string): Promise<Usuario> {

    if (!navigator.onLine) {
      throw new ErrorLogin('Necesitas conexión para iniciar sesión la primera vez.');
    }

    try {

      const respuesta = await firstValueFrom(
        this.http
          .post<Sesion>(`${environment.apiUrl}/login`, {
            email: email.trim(),
            password,
            dispositivo: this.nombreDispositivo(),
          })
          .pipe(timeout(10_000))
      );

      this.guardar(respuesta);
      return respuesta.usuario;

    } catch (e) {
      throw this.traducirError(e);
    }

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
    localStorage.removeItem(CLAVE);
    this.sesion.set(null);
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
