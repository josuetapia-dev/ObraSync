import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom, timeout } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ColaSync, ResultadoCola } from '../../core/sync/cola-sync';
import { ResultadoServidor } from './asistencia.model';
import { AsistenciaRepository } from './asistencia.repository';

/** Cola de asistencias: envía los registros pendientes en lotes a Laravel. */
@Injectable({ providedIn: 'root' })
export class AsistenciaSync implements ColaSync {

  readonly nombre = 'asistencias';

  private http = inject(HttpClient);
  private repo = inject(AsistenciaRepository);

  contarPendientes(userId: number): Promise<number> {
    return this.repo.contarPorEnviar(userId);
  }

  async enviarPendientes(userId: number): Promise<ResultadoCola> {
    const lote = await this.repo.porEnviar(userId);
    if (!lote.length) return { enviados: 0, rechazados: 0, errores: 0 };

    try {
      const respuesta = await firstValueFrom(
        this.http
          .post<{ resultados: ResultadoServidor[] }>(`${environment.apiUrl}/asistencias/sync`, {
            enviado_en: new Date().toISOString(), // el servidor lo compara con su reloj
            registros: lote.map(a => ({
              uuid: a.local_id,
              obra_id: a.obra_id,
              tipo: a.tipo,
              registrado_en: a.registrado_en,
              lat: a.lat,
              lng: a.lng,
              precision_m: a.precision_m,
            })),
          })
          .pipe(timeout(15_000))
      );

      await this.repo.aplicarResultados(respuesta.resultados);
      const rechazados = respuesta.resultados.filter(r => r.estado === 'rechazado').length;
      return { enviados: respuesta.resultados.length - rechazados, rechazados, errores: 0 };

    } catch (e) {
      // Red o servidor: todo el lote queda en "error" y se reintenta en el siguiente ciclo.
      await this.repo.marcarError(lote.map(a => a.local_id), this.describir(e));
      return { enviados: 0, rechazados: 0, errores: lote.length };
    }
  }

  private describir(e: unknown): string {
    if (e instanceof HttpErrorResponse) {
      if (e.status === 0) return 'Sin conexión con el servidor';
      if (e.status === 422) return 'Datos inválidos: ' + (e.error?.message ?? '');
      return `Error del servidor (${e.status})`;
    }
    if (e instanceof Error && e.name === 'TimeoutError') return 'El servidor tardó demasiado';
    return 'Error desconocido';
  }
}
