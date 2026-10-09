import { Injectable, inject } from '@angular/core';

import { Database } from '../../core/database';
import { Condiciones, CondicionesGuardadas, Obra } from './obra.model';

/** Acceso a las tablas locales de obras (patrón Repository: las pantallas no escriben SQL). */
@Injectable({ providedIn: 'root' })
export class ObrasRepository {

  private database = inject(Database);

  private get db() {
    return this.database.conexion;
  }

  async listar(): Promise<Obra[]> {
    const r = await this.db.query('SELECT * FROM obras ORDER BY nombre ASC');
    return r.values ?? [];
  }

  async obtener(id: number): Promise<Obra | null> {
    const r = await this.db.query('SELECT * FROM obras WHERE id = ?', [id]);
    return r.values?.[0] ?? null;
  }

  /**
   * Reemplaza la lista local por la del servidor en una sola transacción.
   * También borra las condiciones de obras que ya no están asignadas.
   */
  async reemplazarTodas(obras: Obra[]) {
    const ids = obras.map(o => o.id);
    const marcas = ids.map(() => '?').join(', ');

    await this.db.executeSet([
      { statement: 'DELETE FROM obras', values: [] },
      ...obras.map(o => ({
        statement: 'INSERT INTO obras (id, nombre, direccion, lat, lng, radio_m, actualizada) VALUES (?, ?, ?, ?, ?, ?, ?)',
        values: [o.id, o.nombre, o.direccion, o.lat, o.lng, o.radio_m, o.actualizada],
      })),
      ids.length
        ? { statement: `DELETE FROM condiciones_obra WHERE obra_id NOT IN (${marcas})`, values: ids }
        : { statement: 'DELETE FROM condiciones_obra', values: [] },
    ], true);
  }

  async leerCondiciones(obraId: number): Promise<CondicionesGuardadas | null> {
    const r = await this.db.query('SELECT datos, guardado_en FROM condiciones_obra WHERE obra_id = ?', [obraId]);
    const fila = r.values?.[0];
    return fila ? { datos: JSON.parse(fila.datos) as Condiciones, guardadoEn: new Date(fila.guardado_en) } : null;
  }

  async guardarCondiciones(obraId: number, datos: Condiciones) {
    await this.db.run(
      `INSERT INTO condiciones_obra (obra_id, datos, guardado_en) VALUES (?, ?, ?)
       ON CONFLICT(obra_id) DO UPDATE SET datos = excluded.datos, guardado_en = excluded.guardado_en`,
      [obraId, JSON.stringify(datos), new Date().toISOString()]
    );
  }

  /** Vacía la caché de obras y condiciones (se vuelve a descargar con conexión). */
  async vaciar() {
    await this.db.executeSet([
      { statement: 'DELETE FROM condiciones_obra', values: [] },
      { statement: 'DELETE FROM obras', values: [] },
    ], true);
  }
}
