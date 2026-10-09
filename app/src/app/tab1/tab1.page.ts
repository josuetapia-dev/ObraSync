import { Component, computed, inject, signal } from '@angular/core';
import { ToastController } from '@ionic/angular/lazy';

import { Catalogo, Producto } from '../services/catalogo';
import { Database } from '../services/database';
import { Estado } from '../services/estado';

interface LineaCarrito {
  producto: Producto;
  cantidad: number;
}

/** Pestaña Vender: catálogo (cache-first) + carrito. Las ventas se guardan en SQLite. */
@Component({
  selector: 'app-tab1',
  templateUrl: 'tab1.page.html',
  styleUrls: ['tab1.page.scss'],
  standalone: false,
})
export class Tab1Page {

  private catalogo = inject(Catalogo);
  private database = inject(Database);
  private toast = inject(ToastController);
  readonly estado = inject(Estado);

  readonly productos = signal<Producto[]>([]);
  readonly cargando = signal(true);
  readonly actualizando = signal(false);
  readonly ultimaActualizacion = signal<Date | null>(null);

  readonly carrito = signal<LineaCarrito[]>([]);
  readonly verCarrito = signal(false);
  readonly cobrando = signal(false);

  readonly totalArticulos = computed(() =>
    this.carrito().reduce((n, l) => n + l.cantidad, 0)
  );

  // Redondeo a centavos para evitar errores de punto flotante (0.1 + 0.2).
  readonly total = computed(() =>
    Math.round(this.carrito().reduce((s, l) => s + l.cantidad * l.producto.precio, 0) * 100) / 100
  );

  ionViewWillEnter() {
    this.cargarCatalogo();
  }

  /** Cache-first: muestra lo guardado al instante y luego lo refresca desde Laravel. */
  async cargarCatalogo() {

    this.productos.set(await this.catalogo.obtenerLocales());
    this.ultimaActualizacion.set(this.catalogo.ultimaActualizacion());
    this.cargando.set(false);

    this.actualizando.set(true);
    const actualizado = await this.catalogo.actualizarDesdeServidor();
    if (actualizado) {
      this.productos.set(await this.catalogo.obtenerLocales());
      this.ultimaActualizacion.set(this.catalogo.ultimaActualizacion());
    }
    this.actualizando.set(false);

  }

  // ======================================================
  // CARRITO
  // ======================================================

  cantidadDe(productoId: number) {
    return this.carrito().find(l => l.producto.id === productoId)?.cantidad ?? 0;
  }

  agregar(producto: Producto) {
    this.carrito.update(lineas => {
      const existe = lineas.some(l => l.producto.id === producto.id);
      return existe
        ? lineas.map(l => l.producto.id === producto.id ? { ...l, cantidad: l.cantidad + 1 } : l)
        : [...lineas, { producto, cantidad: 1 }];
    });
  }

  quitar(producto: Producto) {
    this.carrito.update(lineas =>
      lineas
        .map(l => l.producto.id === producto.id ? { ...l, cantidad: l.cantidad - 1 } : l)
        .filter(l => l.cantidad > 0)
    );
  }

  vaciarCarrito() {
    this.carrito.set([]);
    this.verCarrito.set(false);
  }

  // ======================================================
  // COBRAR
  // ======================================================

  /** Guarda la venta y sus detalles en SQLite (funciona sin internet) y, si hay red, la envía. */
  async cobrar() {

    const lineas = this.carrito();
    if (!lineas.length || this.cobrando()) return;

    this.cobrando.set(true);

    try {

      const ventaId = await this.database.insertarVenta(
        this.total(),
        new Date().toISOString()
      );

      if (!ventaId) throw new Error('No se pudo guardar la venta');

      for (const l of lineas) {
        await this.database.insertarDetalle(ventaId, l.producto.id, l.cantidad, l.producto.precio);
      }

      this.vaciarCarrito();
      await this.estado.refrescarPendientes();

      if (this.estado.enLinea()) {
        this.mostrarToast(`Venta #${ventaId} guardada. Enviando al servidor…`, 'success');
        this.estado.sincronizar();
      } else {
        this.mostrarToast(`Venta #${ventaId} guardada sin conexión. Se enviará al volver la red.`, 'warning');
      }

    } catch (error) {

      console.error('Error al cobrar:', error);
      this.mostrarToast('No se pudo guardar la venta. Intenta de nuevo.', 'danger');

    } finally {

      this.cobrando.set(false);

    }

  }

  private async mostrarToast(message: string, color: string) {
    const t = await this.toast.create({ message, color, duration: 2800, position: 'bottom', positionAnchor: 'tab-bar' });
    await t.present();
  }
}
