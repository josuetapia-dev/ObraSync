import { Injectable, Injector, effect, inject, signal, untracked } from '@angular/core';

import { Auth } from '../auth/auth';
import { Red } from '../red';
import { ColaSync, ResultadoCola } from './cola-sync';

export interface ResumenSync extends ResultadoCola {
  fecha: Date;
}

/** Cada cuánto se reintenta mientras haya pendientes y conexión. */
const INTERVALO_MS = 60_000;

/**
 * MOTOR DE SINCRONIZACIÓN (patrón Outbox)
 *
 * 1. Cada módulo guarda en SQLite con sync_status = 'pending' y registra aquí su cola.
 * 2. El sincronizador envía las colas a Laravel: al abrir la app, al volver la red,
 *    cada minuto si quedan pendientes, o cuando el usuario lo pide.
 * 3. Laravel responde registro por registro: los aceptados pasan a 'synced' (con su
 *    remote_id), los que fallan por red quedan en 'error' y se reintentan después.
 */
@Injectable({ providedIn: 'root' })
export class Sincronizador {

  private auth = inject(Auth);
  private red = inject(Red);
  private injector = inject(Injector);
  private colas: ColaSync[] = [];
  private iniciado = false;

  readonly pendientes = signal(0);
  readonly sincronizando = signal(false);
  readonly ultimo = signal<ResumenSync | null>(null);

  /**
   * Arranca la sincronización automática. Se llama una sola vez, cuando la base local ya
   * está abierta (antes, las colas no tienen de dónde leer).
   */
  iniciar() {
    if (this.iniciado) return;
    this.iniciado = true;

    // Al volver la red (y al iniciar, si hay red), enviar lo pendiente.
    // untracked: el effect solo debe reaccionar a la red. Sin él, también "escucharía" las
    // señales que lee sincronizar() (p. ej. sincronizando) y se dispararía en ciclo infinito.
    effect(() => {
      const enLinea = this.red.enLinea();
      untracked(() => {
        if (enLinea) this.sincronizar();
      });
    }, { injector: this.injector });

    setInterval(() => {
      if (this.pendientes() > 0) this.sincronizar();
    }, INTERVALO_MS);
  }

  /** Cada módulo registra su cola una vez (en su servicio). */
  registrar(cola: ColaSync) {
    if (!this.colas.some(c => c.nombre === cola.nombre)) {
      this.colas.push(cola);
    }
  }

  /** Recalcula el total de pendientes del usuario con sesión. */
  async contar() {
    const userId = this.auth.usuario()?.id;
    if (!userId || !this.iniciado) {
      this.pendientes.set(0);
      return;
    }
    const totales = await Promise.all(this.colas.map(c => c.contarPendientes(userId)));
    this.pendientes.set(totales.reduce((a, b) => a + b, 0));
  }

  /**
   * Envía todas las colas. No hace nada sin red, sin sesión o si ya está sincronizando
   * (así un registro nunca se envía dos veces al mismo tiempo).
   */
  async sincronizar(): Promise<ResumenSync | null> {
    const userId = this.auth.usuario()?.id;
    if (!userId || !this.iniciado || !navigator.onLine || this.sincronizando()) {
      return null;
    }

    this.sincronizando.set(true);
    const total: ResultadoCola = { enviados: 0, rechazados: 0, errores: 0 };

    try {
      for (const cola of this.colas) {
        try {
          const r = await cola.enviarPendientes(userId);
          total.enviados += r.enviados;
          total.rechazados += r.rechazados;
          total.errores += r.errores;
        } catch (e) {
          console.error(`Error sincronizando ${cola.nombre}:`, e);
          total.errores++;
        }
      }
      const resumen = { fecha: new Date(), ...total };
      if (total.enviados || total.rechazados || total.errores) {
        this.ultimo.set(resumen);
      }
      return resumen;
    } finally {
      this.sincronizando.set(false);
      await this.contar();
    }
  }
}
