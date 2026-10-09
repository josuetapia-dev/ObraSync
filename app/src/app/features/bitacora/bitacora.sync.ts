import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom, timeout } from 'rxjs';

import { environment } from '../../../environments/environment';
import { Meta } from '../../core/meta';
import { ColaSync, ResultadoCola } from '../../core/sync/cola-sync';
import { EntradaServidor, ResultadoBitacora } from './bitacora.model';
import { BitacoraRepository } from './bitacora.repository';

/** Por seguridad, máximo de páginas por descarga (200 entradas cada una). */
const MAX_PAGINAS = 10;

/**
 * Cola de la bitácora. En cada sincronización:
 * 1) sube los cambios hechos en este teléfono (el servidor resuelve conflictos);
 * 2) baja lo que cambió la cuadrilla desde la última vez (cursor por usuario).
 */
@Injectable({ providedIn: 'root' })
export class BitacoraSync implements ColaSync {

  readonly nombre = 'bitacora';

  private http = inject(HttpClient);
  private repo = inject(BitacoraRepository);
  private meta = inject(Meta);

  contarPendientes(userId: number): Promise<number> {
    return this.repo.contarPorEnviar(userId);
  }

  async enviarPendientes(userId: number): Promise<ResultadoCola> {
    const resultado = await this.subir(userId);
    try {
      await this.bajar(userId);
    } catch (e) {
      // Si falla la descarga no se pierde nada: se reintenta en la siguiente sincronización.
      console.warn('No se pudo descargar la bitácora:', e);
    }
    return resultado;
  }

  private async subir(userId: number): Promise<ResultadoCola> {
    const lote = await this.repo.porEnviar(userId);
    if (!lote.length) return { enviados: 0, rechazados: 0, errores: 0 };

    // Qué versión se envió de cada una (si se edita mientras viaja, no se pisa).
    const enviados = new Map(lote.map(e => [e.local_id, e.editado_en]));

    try {
      const r = await firstValueFrom(
        this.http
          .post<{ resultados: ResultadoBitacora[] }>(`${environment.apiUrl}/bitacora/sync`, {
            enviado_en: new Date().toISOString(), // para medir el desfase del reloj
            cambios: lote.map(e => ({
              uuid: e.local_id,
              obra_id: e.obra_id,
              categoria: e.categoria,
              titulo: e.titulo,
              descripcion: e.descripcion,
              fecha: e.fecha,
              editado_en: e.editado_en,
              eliminado: !!e.eliminado,
            })),
          })
          .pipe(timeout(15_000))
      );

      await this.repo.aplicarResultados(r.resultados, enviados);
      const rechazados = r.resultados.filter(x => x.estado === 'rechazado').length;
      return { enviados: r.resultados.length - rechazados, rechazados, errores: 0 };

    } catch (e) {
      await this.repo.marcarError(lote.map(x => x.local_id), this.describir(e));
      return { enviados: 0, rechazados: 0, errores: lote.length };
    }
  }

  private async bajar(userId: number) {
    const clave = `bitacora_cursor_${userId}`;
    let cursor = await this.meta.leer(clave);

    for (let pagina = 0; pagina < MAX_PAGINAS; pagina++) {
      const url = `${environment.apiUrl}/bitacora` + (cursor ? `?desde=${encodeURIComponent(cursor)}` : '');
      const r = await firstValueFrom(
        this.http
          .get<{ data: EntradaServidor[]; cursor: string; hay_mas: boolean }>(url)
          .pipe(timeout(15_000))
      );
      await this.repo.mezclarRemotas(r.data);
      cursor = r.cursor;
      await this.meta.guardar(clave, cursor);
      if (!r.hay_mas) break;
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
