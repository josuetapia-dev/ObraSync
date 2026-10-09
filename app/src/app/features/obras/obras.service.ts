import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, timeout } from 'rxjs';

import { environment } from '../../../environments/environment';
import { Meta } from '../../core/meta';
import { Condiciones, CondicionesGuardadas, Obra } from './obra.model';
import { ObrasRepository } from './obras.repository';

const CLAVE_ACTUALIZADAS = 'obras_actualizadas';

/**
 * Obras con estrategia cache-first:
 * 1) se muestra al instante lo guardado en SQLite (funciona sin señal);
 * 2) en segundo plano se pide a Laravel y se actualiza la copia local.
 */
@Injectable({ providedIn: 'root' })
export class ObrasService {

  private http = inject(HttpClient);
  private repo = inject(ObrasRepository);
  private meta = inject(Meta);

  // ---------------------------------------------------------- caché local

  listarLocales(): Promise<Obra[]> {
    return this.repo.listar();
  }

  obtenerLocal(id: number): Promise<Obra | null> {
    return this.repo.obtener(id);
  }

  condicionesLocales(obraId: number): Promise<CondicionesGuardadas | null> {
    return this.repo.leerCondiciones(obraId);
  }

  async ultimaActualizacion(): Promise<Date | null> {
    const v = await this.meta.leer(CLAVE_ACTUALIZADAS);
    return v ? new Date(v) : null;
  }

  // ---------------------------------------------------------- refrescar desde Laravel

  /** Descarga las obras asignadas. Devuelve false si no hay red o falla (se conserva la caché). */
  async refrescarObras(): Promise<boolean> {
    if (!navigator.onLine) return false;
    try {
      const r = await firstValueFrom(
        this.http.get<{ data: Obra[] }>(`${environment.apiUrl}/obras`).pipe(timeout(10_000))
      );
      await this.repo.reemplazarTodas(r.data);
      await this.meta.guardar(CLAVE_ACTUALIZADAS, new Date().toISOString());
      return true;
    } catch (e) {
      console.warn('No se pudieron actualizar las obras:', e);
      return false;
    }
  }

  /** Descarga las condiciones de una obra. Devuelve null si no hay red o falla. */
  async refrescarCondiciones(obraId: number): Promise<CondicionesGuardadas | null> {
    if (!navigator.onLine) return null;
    try {
      const r = await firstValueFrom(
        this.http.get<{ data: Condiciones }>(`${environment.apiUrl}/obras/${obraId}/condiciones`).pipe(timeout(12_000))
      );
      await this.repo.guardarCondiciones(obraId, r.data);
      return { datos: r.data, guardadoEn: new Date() };
    } catch (e) {
      console.warn(`No se pudieron actualizar las condiciones de la obra ${obraId}:`, e);
      return null;
    }
  }

  /** Vacía la caché de forma controlada. */
  async vaciarCache() {
    await this.repo.vaciar();
    await this.meta.borrar(CLAVE_ACTUALIZADAS);
  }
}
