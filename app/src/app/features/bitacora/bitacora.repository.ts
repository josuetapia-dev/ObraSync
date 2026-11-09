import { Injectable, inject } from '@angular/core';

import { Database } from '../../core/database';
import { Usuario } from '../../core/auth/auth';
import { DatosBitacora, EntradaBitacora, EntradaServidor, FiltroBitacora, ResultadoBitacora } from './bitacora.model';

/** Columnas que vienen del servidor (mismo orden que valoresServidor). */
const COLUMNAS = ['remote_id', 'obra_id', 'autor_id', 'autor_nombre', 'editado_por_id', 'editado_por_nombre',
  'categoria', 'titulo', 'descripcion', 'fecha', 'editado_en', 'eliminado'];

/** Valores de una entrada del servidor en el orden de COLUMNAS_SERVIDOR. */
function valoresServidor(e: EntradaServidor): unknown[] {
  return [e.id, e.obra_id, e.autor.id, e.autor.nombre, e.editado_por.id, e.editado_por.nombre,
    e.categoria, e.titulo, e.descripcion, e.fecha, new Date(e.editado_en).toISOString(), e.eliminado ? 1 : 0];
}

/**
 * Repositorio de la bitácora: todo el SQL de la tabla local está aquí.
 * - CRUD offline: crear, actualizar y eliminar guardan en SQLite y marcan 'pending'.
 * - Búsqueda y filtros: se resuelven con SQL (WHERE + LIKE), sin internet.
 * - Sincronización: entrega lo pendiente, aplica la respuesta y mezcla lo descargado.
 */
@Injectable({ providedIn: 'root' })
export class BitacoraRepository {

  private database = inject(Database);

  private get db() {
    return this.database.conexion;
  }

  // ---------------------------------------------------------- consultas

  /**
   * Búsqueda y filtros en SQLite. Arma el WHERE según lo que el usuario eligió:
   * texto (LIKE en título, descripción y autor), categoría, obra y "solo sin enviar".
   * Los valores van como parámetros (?), nunca pegados al SQL: evita inyección SQL.
   */
  async listar(obraIds: number[], filtro: FiltroBitacora = {}): Promise<EntradaBitacora[]> {
    if (!obraIds.length) return [];

    const where = ['eliminado = 0', `obra_id IN (${obraIds.map(() => '?').join(', ')})`];
    const valores: unknown[] = [...obraIds];

    const texto = filtro.texto?.trim();
    if (texto) {
      // Busca en título, descripción y autor. ESCAPE para que % y _ se busquen literalmente.
      const patron = `%${texto.replace(/[\\%_]/g, c => '\\' + c)}%`;
      where.push(`(titulo LIKE ? ESCAPE '\\' OR descripcion LIKE ? ESCAPE '\\' OR autor_nombre LIKE ? ESCAPE '\\')`);
      valores.push(patron, patron, patron);
    }
    if (filtro.categoria) {
      where.push('categoria = ?');
      valores.push(filtro.categoria);
    }
    if (filtro.obraId) {
      where.push('obra_id = ?');
      valores.push(filtro.obraId);
    }
    if (filtro.soloPendientes) {
      where.push(`sync_status IN ('pending', 'error', 'rechazado')`);
    }

    const r = await this.db.query(
      `SELECT * FROM bitacora WHERE ${where.join(' AND ')} ORDER BY fecha DESC, editado_en DESC LIMIT 300`,
      valores
    );
    return r.values ?? [];
  }

  async obtener(localId: string): Promise<EntradaBitacora | null> {
    const r = await this.db.query('SELECT * FROM bitacora WHERE local_id = ?', [localId]);
    return r.values?.[0] ?? null;
  }

  // ---------------------------------------------------------- CRUD: cada cambio queda 'pending' para enviarse

  async crear(datos: DatosBitacora, usuario: Usuario): Promise<string> {
    const id = crypto.randomUUID();
    await this.db.run(
      `INSERT INTO bitacora (local_id, obra_id, autor_id, autor_nombre, editado_por_id, editado_por_nombre,
         categoria, titulo, descripcion, fecha, editado_en, sync_status, pendiente_de)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
      [id, datos.obraId, usuario.id, usuario.nombre, usuario.id, usuario.nombre,
       datos.categoria, datos.titulo, datos.descripcion, datos.fecha, new Date().toISOString(), usuario.id]
    );
    return id;
  }

  async actualizar(localId: string, datos: Omit<DatosBitacora, 'obraId'>, usuario: Usuario) {
    await this.db.run(
      `UPDATE bitacora
          SET categoria = ?, titulo = ?, descripcion = ?, fecha = ?,
              editado_en = ?, editado_por_id = ?, editado_por_nombre = ?,
              sync_status = 'pending', pendiente_de = ?, intentos = 0, ultimo_error = NULL, conflicto = 0
        WHERE local_id = ?`,
      [datos.categoria, datos.titulo, datos.descripcion, datos.fecha,
       new Date().toISOString(), usuario.id, usuario.nombre, usuario.id, localId]
    );
  }

  /** Borrar = marcar eliminado y avisar al servidor (así desaparece en los demás teléfonos). */
  async eliminar(localId: string, usuario: Usuario) {
    const e = await this.obtener(localId);
    if (!e) return;
    const nuncaLlego = !e.remote_id && (e.sync_status === 'rechazado' || (e.sync_status === 'pending' && e.intentos === 0));
    if (nuncaLlego) {
      // No existe en el servidor: basta con borrarla aquí.
      await this.db.run('DELETE FROM bitacora WHERE local_id = ?', [localId]);
      return;
    }
    await this.db.run(
      `UPDATE bitacora
          SET eliminado = 1, editado_en = ?, editado_por_id = ?, editado_por_nombre = ?,
              sync_status = 'pending', pendiente_de = ?, intentos = 0, ultimo_error = NULL, conflicto = 0
        WHERE local_id = ?`,
      [new Date().toISOString(), usuario.id, usuario.nombre, usuario.id, localId]
    );
  }

  // ---------------------------------------------------------- outbox (subir)

  /** Cambios de este usuario por enviar (pendientes o con error). */
  async porEnviar(userId: number, limite = 100): Promise<EntradaBitacora[]> {
    const r = await this.db.query(
      `SELECT * FROM bitacora WHERE pendiente_de = ? AND sync_status IN ('pending', 'error')
        ORDER BY editado_en ASC LIMIT ?`,
      [userId, limite]
    );
    return r.values ?? [];
  }

  async contarPorEnviar(userId: number): Promise<number> {
    const r = await this.db.query(
      `SELECT COUNT(*) AS n FROM bitacora WHERE pendiente_de = ? AND sync_status IN ('pending', 'error')`,
      [userId]
    );
    return Number(r.values?.[0]?.n ?? 0);
  }

  /**
   * Aplica la respuesta del servidor. Solo toca la fila si no se volvió a editar mientras
   * viajaba la petición (editado_en igual al enviado); si cambió, queda pendiente para el siguiente envío.
   * - aplicado: se guarda la versión del servidor.
   * - conflicto: se adopta la versión ganadora del servidor y se marca para avisar al usuario.
   * - rechazado: se marca con el motivo (no se reintenta).
   */
  async aplicarResultados(resultados: ResultadoBitacora[], enviados: Map<string, string>) {
    const sentencias = resultados.flatMap(r => {
      const editadoEnviado = enviados.get(r.uuid);
      if (!editadoEnviado) return [];

      if (r.estado === 'rechazado' || !r.entrada) {
        return [{
          statement: `UPDATE bitacora SET sync_status = 'rechazado', ultimo_error = ?
                       WHERE local_id = ? AND editado_en = ?`,
          values: [r.motivo ?? 'Rechazado por el servidor', r.uuid, editadoEnviado],
        }];
      }
      return [{
        statement: `UPDATE bitacora
                       SET ${COLUMNAS.map(c => `${c} = ?`).join(', ')},
                           sync_status = 'synced', pendiente_de = NULL, intentos = 0, ultimo_error = NULL, conflicto = ?
                     WHERE local_id = ? AND editado_en = ?`,
        values: [...valoresServidor(r.entrada), r.estado === 'conflicto' ? 1 : 0, r.uuid, editadoEnviado],
      }];
    });
    if (sentencias.length) await this.db.executeSet(sentencias, true);
  }

  async marcarError(localIds: string[], mensaje: string) {
    if (!localIds.length) return;
    await this.db.run(
      `UPDATE bitacora SET sync_status = 'error', intentos = intentos + 1, ultimo_error = ?
        WHERE local_id IN (${localIds.map(() => '?').join(', ')}) AND sync_status IN ('pending', 'error')`,
      [mensaje, ...localIds]
    );
  }

  // ---------------------------------------------------------- bajar cambios de la cuadrilla

  /**
   * Mezcla lo descargado. Nunca pisa un cambio local que aún no se envía: ese se sube
   * en el siguiente envío y el servidor decide quién gana (la edición más reciente).
   */
  async mezclarRemotas(entradas: EntradaServidor[]) {
    if (!entradas.length) return;
    const marcas = COLUMNAS.map(() => '?').join(', ');
    const asignaciones = COLUMNAS.map(c => `${c} = excluded.${c}`).join(', ');

    await this.db.executeSet(entradas.map(e => ({
      statement: `INSERT INTO bitacora (local_id, ${COLUMNAS.join(', ')}, sync_status) VALUES (?, ${marcas}, 'synced')
                  ON CONFLICT(local_id) DO UPDATE SET ${asignaciones},
                     sync_status = 'synced', pendiente_de = NULL, ultimo_error = NULL,
                     conflicto = CASE WHEN bitacora.editado_en = excluded.editado_en THEN bitacora.conflicto ELSE 0 END
                  WHERE bitacora.sync_status NOT IN ('pending', 'error')`,
      values: [e.uuid, ...valoresServidor(e)],
    })), true);
  }
}
