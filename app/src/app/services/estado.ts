import { Injectable, signal } from '@angular/core';

import { Database } from './database';
import { Sync } from './sync';

/** Resultado de la última sincronización (para mostrarlo en pantalla). */
export interface ResultadoSync {
  fecha: Date;
  sincronizadas: number;
  errores: number;
}

/** Cada cuánto se reintenta enviar pendientes mientras haya conexión. */
const REINTENTO_MS = 60_000;

/**
 * Estado compartido de la app: conexión, ventas pendientes y sincronización.
 * - Detecta cuándo se pierde o vuelve la red.
 * - Al volver la red, envía solo las ventas pendientes a Laravel.
 * - Reintenta cada minuto mientras queden pendientes.
 */
@Injectable({
  providedIn: 'root',
})
export class Estado {

  readonly enLinea = signal(navigator.onLine);
  readonly pendientes = signal(0);
  readonly sincronizando = signal(false);
  readonly ultimaSync = signal<ResultadoSync | null>(null);

  constructor(
    private database: Database,
    private sync: Sync
  ) {

    window.addEventListener('online', () => {
      this.enLinea.set(true);
      this.sincronizar(); // envío al recuperar conexión
    });

    window.addEventListener('offline', () => {
      this.enLinea.set(false);
    });

    // Reintento periódico (p. ej. si el servidor estaba caído aunque hubiera red).
    setInterval(() => {
      if (this.pendientes() > 0) this.sincronizar();
    }, REINTENTO_MS);

  }

  /** Vuelve a contar las ventas sin sincronizar. */
  async refrescarPendientes() {
    this.pendientes.set(await this.database.contarPendientes());
  }

  /**
   * Envía las ventas pendientes. No hace nada si no hay red o si ya se está sincronizando
   * (evita enviar la misma venta dos veces al mismo tiempo).
   */
  async sincronizar(): Promise<ResultadoSync | null> {

    if (this.sincronizando() || !navigator.onLine) {
      return null;
    }

    this.sincronizando.set(true);

    try {

      const r = await this.sync.sincronizarVentas();
      const resultado = { fecha: new Date(), ...r };
      this.ultimaSync.set(resultado);
      return resultado;

    } finally {

      this.sincronizando.set(false);
      await this.refrescarPendientes();

    }

  }
}
