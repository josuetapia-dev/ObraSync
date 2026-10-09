import { Component, effect, inject, signal, untracked } from '@angular/core';
import { AlertController } from '@ionic/angular/lazy';

import { Catalogo } from '../services/catalogo';
import { Database } from '../services/database';
import { Estado } from '../services/estado';

/** Pestaña Ventas: historial local con su estado de sincronización y detalles. */
@Component({
  selector: 'app-tab2',
  templateUrl: 'tab2.page.html',
  styleUrls: ['tab2.page.scss'],
  standalone: false,
})
export class Tab2Page {

  private database = inject(Database);
  private catalogo = inject(Catalogo);
  private alert = inject(AlertController);
  readonly estado = inject(Estado);

  readonly ventas = signal<any[]>([]);
  readonly cargando = signal(true);
  readonly abierta = signal<number | null>(null);
  readonly detalles = signal<Record<number, any[]>>({});
  private nombres = new Map<number, string>();

  constructor() {
    // Si termina una sincronización mientras estás en esta pestaña, refresca los estados.
    effect(() => {
      this.estado.ultimaSync();
      untracked(() => this.cargar());
    });
  }

  ionViewWillEnter() {
    this.cargar();
  }

  async cargar() {

    const [ventas, productos] = await Promise.all([
      this.database.obtenerVentas(),
      this.catalogo.obtenerLocales(),
    ]);

    this.nombres = new Map(productos.map(p => [p.id, p.nombre]));
    this.ventas.set(ventas);
    this.cargando.set(false);

  }

  /** Jalar hacia abajo para refrescar. */
  async refrescar(event: CustomEvent) {
    await this.cargar();
    (event.target as HTMLIonRefresherElement).complete();
  }

  /** Abre/cierra una venta y carga sus detalles la primera vez. */
  async alternar(ventaId: number) {

    if (this.abierta() === ventaId) {
      this.abierta.set(null);
      return;
    }

    if (!this.detalles()[ventaId]) {
      const lista = await this.database.obtenerDetalles(ventaId);
      this.detalles.update(d => ({ ...d, [ventaId]: lista }));
    }

    this.abierta.set(ventaId);

  }

  nombreProducto(id: number) {
    return this.nombres.get(id) ?? `Producto #${id}`;
  }

  /** Solo se pueden eliminar ventas pendientes (las sincronizadas ya están en el servidor). */
  async confirmarEliminar(venta: any) {

    const a = await this.alert.create({
      header: `¿Eliminar venta #${venta.id}?`,
      message: 'Aún no se envía al servidor; se borrará de este dispositivo.',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Eliminar',
          role: 'destructive',
          handler: async () => {
            await this.database.eliminarVenta(venta.id);
            this.abierta.set(null);
            await this.cargar();
            await this.estado.refrescarPendientes();
          },
        },
      ],
    });

    await a.present();

  }
}
