import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { AlertController, ToastController } from '@ionic/angular/lazy';

import { Auth } from '../../core/auth/auth';
import { distanciaMetros, formatearDistancia } from '../../core/geo';
import { Red } from '../../core/red';
import { Sincronizador } from '../../core/sync/sincronizador';
import { ErrorUbicacion, Posicion, Ubicacion } from '../../core/ubicacion';
import { Obra } from '../obras/obra.model';
import { ObrasService } from '../obras/obras.service';
import { Asistencia } from './asistencia.model';
import { AsistenciaRepository } from './asistencia.repository';

/** Más de esto con la entrada abierta suele ser una salida olvidada. */
const HORAS_TURNO_LARGO = 14;
/** Arriba de esto el GPS es poco confiable (mismo límite que el servidor). */
const PRECISION_MAXIMA_M = 100;

interface Etiqueta { clase: 'ok' | 'warn' | 'danger'; icono: string; texto: string; }

/**
 * "Checar": registra entrada y salida con la ubicación del GPS.
 * - Funciona sin señal: se guarda en SQLite y el sincronizador lo envía después.
 * - La distancia que se muestra es una vista previa; la oficial la calcula el servidor.
 * - Fuera del radio no se bloquea (el GPS puede fallar): se avisa y queda marcado.
 */
@Component({
  selector: 'app-checar',
  templateUrl: 'checar.page.html',
  styleUrls: ['checar.page.scss'],
  standalone: false,
})
export class ChecarPage {

  private auth = inject(Auth);
  private repo = inject(AsistenciaRepository);
  private obrasService = inject(ObrasService);
  private ubicacion = inject(Ubicacion);
  private sync = inject(Sincronizador);
  private alert = inject(AlertController);
  private toast = inject(ToastController);
  readonly red = inject(Red);

  readonly obras = signal<Obra[]>([]);
  readonly obraId = signal<number | null>(null);
  readonly historial = signal<Asistencia[]>([]);
  readonly cargando = signal(true);

  readonly posicion = signal<Posicion | null>(null);
  readonly buscandoGps = signal(false);
  readonly errorGps = signal<string | null>(null);
  readonly registrando = signal(false);

  /** Reloj de la pantalla (cada segundo) para el tiempo de turno. */
  readonly ahora = signal(Date.now());
  private reloj?: ReturnType<typeof setInterval>;
  private visible = false;
  private eligioObra = false;

  readonly formatearDistancia = formatearDistancia;

  // ---------------------------------------------------------- estado derivado

  /** Último registro: si es una entrada, el turno sigue abierto. */
  readonly turnoAbierto = computed(() => {
    const u = this.historial()[0];
    return u?.tipo === 'entrada' ? u : null;
  });

  readonly siguiente = computed(() => (this.turnoAbierto() ? 'salida' : 'entrada'));

  readonly obra = computed(() => this.obras().find(o => o.id === this.obraId()) ?? null);

  readonly nombres = computed(() => new Map(this.obras().map(o => [o.id, o.nombre])));

  readonly distancia = computed(() => {
    const p = this.posicion();
    const o = this.obra();
    return p && o ? distanciaMetros(p.lat, p.lng, o.lat, o.lng) : null;
  });

  readonly dentro = computed(() => {
    const d = this.distancia();
    const o = this.obra();
    return d !== null && !!o && d <= o.radio_m;
  });

  readonly precisionBaja = computed(() => (this.posicion()?.precisionM ?? 0) > PRECISION_MAXIMA_M);

  readonly duracionMs = computed(() => {
    const t = this.turnoAbierto();
    return t ? Math.max(0, this.ahora() - new Date(t.registrado_en).getTime()) : 0;
  });

  readonly duracion = computed(() => {
    const s = Math.floor(this.duracionMs() / 1000);
    const dos = (n: number) => String(n).padStart(2, '0');
    return `${dos(Math.floor(s / 3600))}:${dos(Math.floor((s % 3600) / 60))}:${dos(s % 60)}`;
  });

  readonly turnoLargo = computed(() => this.duracionMs() > HORAS_TURNO_LARGO * 3600_000);

  constructor() {
    // Cuando el sincronizador termina un envío, refrescar los estados del historial.
    effect(() => {
      if (!this.sync.sincronizando()) {
        untracked(() => { if (this.visible) this.cargarHistorial(); });
      }
    });
  }

  // ---------------------------------------------------------- ciclo de vida

  async ionViewWillEnter() {
    this.visible = true;
    this.reloj = setInterval(() => this.ahora.set(Date.now()), 1000);

    this.obras.set(await this.obrasService.listarLocales());
    await this.cargarHistorial();
    this.elegirObra();
    this.cargando.set(false);

    this.actualizarUbicacion();
  }

  ionViewWillLeave() {
    this.visible = false;
    clearInterval(this.reloj);
  }

  async cargarHistorial() {
    const userId = this.auth.usuario()?.id;
    this.historial.set(userId ? await this.repo.recientes(userId, 30) : []);
  }

  /** Con turno abierto, la obra es la de la entrada. Si no, la que eligió o la más cercana. */
  private elegirObra() {
    const abierto = this.turnoAbierto();
    if (abierto) {
      this.obraId.set(abierto.obra_id);
      return;
    }
    const valida = this.obras().some(o => o.id === this.obraId());
    if (this.eligioObra && valida) return;

    const p = this.posicion();
    const obras = this.obras();
    if (p && obras.length) {
      const cercana = [...obras].sort((a, b) =>
        distanciaMetros(p.lat, p.lng, a.lat, a.lng) - distanciaMetros(p.lat, p.lng, b.lat, b.lng))[0];
      this.obraId.set(cercana.id);
    } else if (!valida) {
      this.obraId.set(obras[0]?.id ?? null);
    }
  }

  cambiarObra(valor: string) {
    this.eligioObra = true;
    this.obraId.set(Number(valor));
  }

  // ---------------------------------------------------------- GPS

  async actualizarUbicacion(): Promise<Posicion | null> {
    this.buscandoGps.set(true);
    this.errorGps.set(null);
    try {
      const p = await this.ubicacion.obtener();
      this.posicion.set(p);
      this.elegirObra();
      return p;
    } catch (e) {
      this.errorGps.set(e instanceof ErrorUbicacion ? e.message : 'No se pudo obtener tu ubicación.');
      return null;
    } finally {
      this.buscandoGps.set(false);
    }
  }

  // ---------------------------------------------------------- registrar

  async registrar() {
    const userId = this.auth.usuario()?.id;
    const obra = this.obra();
    if (!userId || !obra || this.registrando()) return;

    this.registrando.set(true);
    try {
      // Siempre una lectura nueva: la ubicación guardada es la del momento de checar.
      const p = await this.actualizarUbicacion();
      if (!p) return;

      if (!this.dentro() && !(await this.confirmarFueraDeRadio(obra))) return;

      const tipo = this.siguiente();
      await this.repo.insertar({ userId, obraId: obra.id, tipo, lat: p.lat, lng: p.lng, precisionM: p.precisionM });
      await this.cargarHistorial();
      await this.sync.contar();

      await this.avisar(
        `${tipo === 'entrada' ? 'Entrada' : 'Salida'} registrada` +
        (this.red.enLinea() ? '.' : ' en el teléfono. Se enviará al volver la señal.')
      );
      this.sync.sincronizar(); // en segundo plano; el historial se actualiza al terminar
    } finally {
      this.registrando.set(false);
    }
  }

  private async confirmarFueraDeRadio(obra: Obra): Promise<boolean> {
    const d = this.distancia();
    const a = await this.alert.create({
      header: 'Estás fuera del radio',
      message: `Estás a ${d !== null ? formatearDistancia(d) : '?'} de ${obra.nombre} (el radio es de ${obra.radio_m} m). ` +
        'Puedes registrar de todos modos; la oficina lo verá marcado como fuera del radio.',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Registrar así', role: 'confirm' },
      ],
    });
    await a.present();
    return (await a.onDidDismiss()).role === 'confirm';
  }

  private async avisar(mensaje: string) {
    const t = await this.toast.create({
      message: mensaje,
      duration: 3000,
      position: 'bottom',
      positionAnchor: 'tab-bar',
      icon: 'checkmark-circle-outline',
    });
    await t.present();
  }

  // ---------------------------------------------------------- historial

  /** Etiquetas de estado de cada registro (texto + icono, no solo color). */
  etiquetas(a: Asistencia): Etiqueta[] {
    switch (a.sync_status) {
      case 'pending':
        return [{ clase: 'warn', icono: 'cloud-upload-outline', texto: 'Sin enviar' }];
      case 'error':
        return [{ clase: 'warn', icono: 'sync-outline', texto: 'Reintentando' }];
      case 'rechazado':
        return [{ clase: 'danger', icono: 'close-circle-outline', texto: 'Rechazado' }];
    }
    const lista: Etiqueta[] = [];
    const dist = a.distancia_m !== null ? ` · ${formatearDistancia(a.distancia_m)}` : '';
    lista.push(a.dentro_radio
      ? { clase: 'ok', icono: 'checkmark-circle-outline', texto: 'En la obra' + dist }
      : { clase: 'danger', icono: 'alert-circle-outline', texto: 'Fuera del radio' + dist });
    if (a.reloj_sospechoso) lista.push({ clase: 'warn', icono: 'time-outline', texto: 'Hora corregida' });
    if (a.precision_baja) lista.push({ clase: 'warn', icono: 'locate-outline', texto: 'GPS impreciso' });
    return lista;
  }
}
