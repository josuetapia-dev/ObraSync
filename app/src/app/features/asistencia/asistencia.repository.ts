import { Injectable, inject } from '@angular/core';

import { Database } from '../../core/database';
import { Asistencia, ResultadoServidor, TipoAsistencia } from './asistencia.model';

/** Acceso a la tabla local de asistencias (las pantallas no escriben SQL). */
@Injectable({ providedIn: 'root' })
export class AsistenciaRepository {

  private database = inject(Database);

  private get db() {
    return this.database.conexion;
  }

  /** Guarda un registro nuevo como pendiente de enviar. */
  async insertar(datos: {
    userId: number; obraId: number; tipo: TipoAsistencia;
    lat: number; lng: number; precisionM: number | null;
  }): Promise<Asistencia> {
    const ahora = new Date().toISOString();
    const registro: Asistencia = {
      local_id: crypto.randomUUID(),
      remote_id: null,
      user_id: datos.userId,
      obra_id: datos.obraId,
      tipo: datos.tipo,
      registrado_en: ahora,
      lat: datos.lat,
      lng: datos.lng,
      precision_m: datos.precisionM,
      sync_status: 'pending',
      intentos: 0,
      ultimo_error: null,
      dentro_radio: null,
      distancia_m: null,
      reloj_sospechoso: null,
      precision_baja: null,
      updated_at: ahora,
    };

    await this.db.run(
      `INSERT INTO asistencias
         (local_id, user_id, obra_id, tipo, registrado_en, lat, lng, precision_m, sync_status, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
      [registro.local_id, registro.user_id, registro.obra_id, registro.tipo, registro.registrado_en,
       registro.lat, registro.lng, registro.precision_m, registro.updated_at]
    );
    return registro;
  }

  /** Últimos registros del usuario (más recientes primero). */
  async recientes(userId: number, limite = 50): Promise<Asistencia[]> {
    const r = await this.db.query(
      'SELECT * FROM asistencias WHERE user_id = ? ORDER BY registrado_en DESC LIMIT ?',
      [userId, limite]
    );
    return r.values ?? [];
  }

  /** Último registro del usuario (para saber si toca entrada o salida). */
  async ultimo(userId: number): Promise<Asistencia | null> {
    return (await this.recientes(userId, 1))[0] ?? null;
  }

  // ---------------------------------------------------------- outbox

  /** Pendientes o con error (se reintentan). Los rechazados ya no. */
  async porEnviar(userId: number, limite = 100): Promise<Asistencia[]> {
    const r = await this.db.query(
      `SELECT * FROM asistencias
        WHERE user_id = ? AND sync_status IN ('pending', 'error')
        ORDER BY registrado_en ASC LIMIT ?`,
      [userId, limite]
    );
    return r.values ?? [];
  }

  async contarPorEnviar(userId: number): Promise<number> {
    const r = await this.db.query(
      `SELECT COUNT(*) AS n FROM asistencias WHERE user_id = ? AND sync_status IN ('pending', 'error')`,
      [userId]
    );
    return Number(r.values?.[0]?.n ?? 0);
  }

  /**
   * Aplica la respuesta de Laravel, registro por registro y en una sola transacción.
   * Se busca por local_id (el UUID enviado) y se guarda el remote_id que asignó MySQL.
   */
  async aplicarResultados(resultados: ResultadoServidor[]) {
    const ahora = new Date().toISOString();
    const sentencias = resultados.map(r =>
      r.estado === 'rechazado'
        ? {
            statement: `UPDATE asistencias SET sync_status = 'rechazado', ultimo_error = ?, updated_at = ? WHERE local_id = ?`,
            values: [r.motivo ?? 'Rechazado por el servidor', ahora, r.uuid],
          }
        : {
            statement: `UPDATE asistencias
                           SET sync_status = 'synced', remote_id = ?, dentro_radio = ?, distancia_m = ?,
                               reloj_sospechoso = ?, precision_baja = ?, ultimo_error = NULL, updated_at = ?
                         WHERE local_id = ?`,
            values: [r.id ?? null, r.dentro_radio ? 1 : 0, r.distancia_m ?? null,
                     r.reloj_sospechoso ? 1 : 0, r.precision_baja ? 1 : 0, ahora, r.uuid],
          }
    );
    if (sentencias.length) await this.db.executeSet(sentencias, true);
  }

  /** Reintentos: si el envío falla (sin red, servidor caído), queda en 'error' con intentos + 1. */
  async marcarError(localIds: string[], mensaje: string) {
    if (!localIds.length) return;
    const marcas = localIds.map(() => '?').join(', ');
    await this.db.run(
      `UPDATE asistencias SET sync_status = 'error', intentos = intentos + 1, ultimo_error = ?, updated_at = ?
        WHERE local_id IN (${marcas})`,
      [mensaje, new Date().toISOString(), ...localIds]
    );
  }
}
