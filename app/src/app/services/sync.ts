import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { Database } from './database';

/**
 * Envía a la API de Laravel las ventas guardadas localmente que aún no se sincronizan.
 * Cada venta se manda con sus detalles; si Laravel responde con el id del servidor,
 * se marca como sincronizada en SQLite. Si falla, queda pendiente para reintentar.
 */
@Injectable({
  providedIn: 'root',
})
export class Sync {

  // CAMBIA ESTA URL POR LA DE TU API LARAVEL
  // Laravel corre en XAMPP (C:\xampp\htdocs\ventas-api). En un celular cambia
  // "localhost" por la IP de tu PC en la red (p. ej. 192.168.1.50).
  private apiUrl = 'http://localhost/ventas-api/public/api/ventas';

  constructor(
    private http: HttpClient,
    private database: Database
  ) {}

  // ======================================================
  // SINCRONIZAR TODAS LAS VENTAS PENDIENTES
  // ======================================================

  async sincronizarVentas() {

    try {

      // 1. Obtener ventas pendientes desde SQLite
      const ventas =
        await this.database.obtenerPendientesCompletas();

      if (ventas.length === 0) {

        console.log(
          'No existen ventas pendientes'
        );

        return {
          sincronizadas: 0,
          errores: 0
        };

      }

      let sincronizadas = 0;
      let errores = 0;

      // 2. Recorrer ventas pendientes
      for (const venta of ventas) {

        try {

          // 3. Mapear la venta local al formato que espera Laravel.
          //    dispositivo_id + local_id permiten a Laravel detectar reenvíos (no duplica).
          //    Los detalles se transforman con .map() para enviar solo los campos necesarios.
          const datos = {
            dispositivo_id: this.obtenerDispositivoId(),
            local_id: venta.id,
            total: venta.total,
            fecha: venta.fecha,
            detalles: venta.detalles.map((d: any) => ({
              producto_id: d.producto_id,
              cantidad: d.cantidad,
              precio: d.precio,
              subtotal: d.subtotal
            }))
          };

          console.log(
            'Datos enviados a Laravel:',
            datos
          );

          // 4. Enviar venta a Laravel
          const respuesta: any =
            await firstValueFrom(

              this.http.post(
                this.apiUrl,
                datos
              )

            );

          console.log(
            'Respuesta de Laravel:',
            respuesta
          );

          // 5. Laravel responde { id } con el id que asignó en MySQL
          const serverId =
            respuesta?.id;

          if (!serverId) {
            throw new Error('Laravel no devolvió el id de la venta');
          }

          // 6. Marcar como sincronizada en SQLite
          await this.database.marcarSincronizada(
            venta.id,
            serverId
          );

          sincronizadas++;

          console.log(
            'Venta sincronizada correctamente:',
            venta.id
          );

        } catch (error) {

          // La venta sigue con sincronizado = 0; se reintentará en la próxima sincronización.
          console.error(
            'Error sincronizando venta:',
            venta.id,
            error
          );

          errores++;

        }

      }

      console.log(
        'Sincronización terminada:',
        sincronizadas,
        'sincronizadas,',
        errores,
        'con error'
      );

      return {
        sincronizadas,
        errores
      };

    } catch (error) {

      console.error(
        'Error general de sincronización:',
        error
      );

      return {
        sincronizadas: 0,
        errores: 1
      };

    }

  }

  // ======================================================
  // IDENTIFICADOR DEL DISPOSITIVO
  // ======================================================

  /** UUID que identifica este navegador/teléfono. Se genera una vez y se guarda. */
  private obtenerDispositivoId(): string {

    let id = localStorage.getItem('dispositivo_id');

    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem('dispositivo_id', id);
    }

    return id;

  }
}
