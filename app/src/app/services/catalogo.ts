import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, timeout } from 'rxjs';

import { Database } from './database';

export interface Producto {
  id: number;
  nombre: string;
  descripcion: string | null;
  precio: number;
}

/**
 * Catálogo de productos con estrategia cache-first:
 * 1) se muestra al instante lo guardado en SQLite (funciona sin internet);
 * 2) en segundo plano se pide a Laravel y se actualiza la copia local.
 */
@Injectable({
  providedIn: 'root',
})
export class Catalogo {

  // CAMBIA ESTA URL POR LA DE TU API LARAVEL
  private apiUrl = 'http://localhost/ventas-api/public/api/productos';

  constructor(
    private http: HttpClient,
    private database: Database
  ) {}

  // ======================================================
  // LEER CACHÉ LOCAL
  // ======================================================

  /** Productos guardados en el dispositivo. */
  async obtenerLocales(): Promise<Producto[]> {
    return this.database.obtenerProductos();
  }

  /** Fecha de la última vez que se descargó el catálogo (null si nunca). */
  ultimaActualizacion(): Date | null {
    const valor = localStorage.getItem('productos_actualizados');
    return valor ? new Date(valor) : null;
  }

  // ======================================================
  // REFRESCAR DESDE LARAVEL
  // ======================================================

  /**
   * Descarga el catálogo y reemplaza la caché local.
   * Devuelve true si se actualizó; false si no hubo conexión o falló el servidor
   * (en ese caso se sigue usando la caché).
   */
  async actualizarDesdeServidor(): Promise<boolean> {

    if (!navigator.onLine) {
      return false;
    }

    try {

      const productos =
        await firstValueFrom(
          this.http.get<Producto[]>(this.apiUrl).pipe(timeout(8000))
        );

      await this.database.guardarProductos(productos);

      localStorage.setItem(
        'productos_actualizados',
        new Date().toISOString()
      );

      return true;

    } catch (error) {

      console.error(
        'No se pudo actualizar el catálogo:',
        error
      );

      return false;

    }

  }

  // ======================================================
  // VACIAR CACHÉ
  // ======================================================

  /** Borra el catálogo local de forma controlada (se vuelve a descargar al refrescar). */
  async vaciarCache() {
    await this.database.guardarProductos([]);
    localStorage.removeItem('productos_actualizados');
  }
}
