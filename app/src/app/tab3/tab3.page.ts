import { Component, inject, signal } from '@angular/core';
import { AlertController, ToastController } from '@ionic/angular/lazy';

import { Catalogo } from '../services/catalogo';
import { Database } from '../services/database';
import { Estado } from '../services/estado';

/** Pestaña Sincronizar: conexión, envío manual de pendientes y control de la caché. */
@Component({
  selector: 'app-tab3',
  templateUrl: 'tab3.page.html',
  styleUrls: ['tab3.page.scss'],
  standalone: false,
})
export class Tab3Page {

  private catalogo = inject(Catalogo);
  private database = inject(Database);
  private alert = inject(AlertController);
  private toast = inject(ToastController);
  readonly estado = inject(Estado);

  readonly totalProductos = signal(0);
  readonly ultimaCatalogo = signal<Date | null>(null);
  readonly actualizandoCatalogo = signal(false);

  ionViewWillEnter() {
    this.cargarCatalogo();
    this.estado.refrescarPendientes();
  }

  private async cargarCatalogo() {
    this.totalProductos.set((await this.catalogo.obtenerLocales()).length);
    this.ultimaCatalogo.set(this.catalogo.ultimaActualizacion());
  }

  // ======================================================
  // VENTAS
  // ======================================================

  async sincronizarAhora() {

    const r = await this.estado.sincronizar();

    if (!r) {
      this.mostrarToast('Sin conexión. Las ventas se enviarán al volver la red.', 'warning');
    } else if (r.errores > 0) {
      this.mostrarToast(`${r.sincronizadas} enviadas, ${r.errores} con error. Se reintentará.`, 'warning');
    } else if (r.sincronizadas > 0) {
      this.mostrarToast(`${r.sincronizadas} ${r.sincronizadas === 1 ? 'venta enviada' : 'ventas enviadas'} al servidor.`, 'success');
    } else {
      this.mostrarToast('No había ventas pendientes.', 'medium');
    }

  }

  // ======================================================
  // CATÁLOGO
  // ======================================================

  async actualizarCatalogo() {

    this.actualizandoCatalogo.set(true);
    const ok = await this.catalogo.actualizarDesdeServidor();
    await this.cargarCatalogo();
    this.actualizandoCatalogo.set(false);

    this.mostrarToast(
      ok ? 'Catálogo actualizado.' : 'No se pudo conectar con el servidor. Se mantiene el catálogo guardado.',
      ok ? 'success' : 'warning'
    );

  }

  async confirmarVaciarCache() {
    await this.confirmar(
      '¿Vaciar caché del catálogo?',
      'Se borrarán los productos guardados. Se descargarán de nuevo cuando haya conexión.',
      'Vaciar',
      async () => {
        await this.catalogo.vaciarCache();
        await this.cargarCatalogo();
      }
    );
  }

  // ======================================================
  // PRUEBAS
  // ======================================================

  async confirmarBorrarDatos() {
    await this.confirmar(
      '¿Borrar todas las ventas locales?',
      'Se eliminarán de este dispositivo, incluidas las pendientes. Lo que ya está en el servidor no se toca.',
      'Borrar',
      async () => {
        await this.database.limpiarBaseDatos();
        await this.estado.refrescarPendientes();
        this.mostrarToast('Ventas locales borradas.', 'medium');
      }
    );
  }

  private async confirmar(header: string, message: string, accion: string, handler: () => Promise<void>) {
    const a = await this.alert.create({
      header,
      message,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: accion, role: 'destructive', handler: () => { handler(); } },
      ],
    });
    await a.present();
  }

  private async mostrarToast(message: string, color: string) {
    const t = await this.toast.create({ message, color, duration: 2800, position: 'bottom', positionAnchor: 'tab-bar' });
    await t.present();
  }
}
