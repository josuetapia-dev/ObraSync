import { Injectable } from '@angular/core';
import {
  CapacitorSQLite,
  SQLiteConnection,
  SQLiteDBConnection,
} from '@capacitor-community/sqlite';

/**
 * BASE DE DATOS LOCAL (SQLite)
 *
 * La app guarda todo primero en el teléfono, así funciona sin internet.
 * - En Android/iOS usa SQLite nativo; en el navegador, jeep-sqlite (guarda en IndexedDB).
 * - Las pantallas no escriben SQL: usan un repositorio por módulo (patrón Repository).
 *
 * Cola de sincronización: las tablas que se envían a Laravel (asistencias, bitacora) tienen
 *   local_id     id creado en el teléfono (UUID), existe aunque no haya red
 *   remote_id    id que asigna MySQL al recibirlo
 *   sync_status  pending (falta enviar) | synced (enviado) | error (se reintenta) | rechazado
 *   intentos     cuántas veces falló el envío; ultimo_error guarda el motivo
 */

const DB_NAME = 'obrasync';

/**
 * Migraciones: cada elemento es una versión de la base (v1, v2, ...).
 * SQLite guarda la última aplicada en PRAGMA user_version, así cada teléfono solo ejecuta
 * las que le faltan y no pierde sus datos. Para cambiar la base se agrega una versión al
 * final; nunca se edita una existente.
 */
const MIGRACIONES: string[] = [
  // v1: tabla clave/valor para datos sueltos (p. ej. fecha de la última sincronización).
  `CREATE TABLE IF NOT EXISTS meta (
     clave TEXT PRIMARY KEY,
     valor TEXT
   );`,

  // v2: caché de obras y del clima (cache-first: se muestra lo guardado y luego se actualiza).
  `CREATE TABLE IF NOT EXISTS obras (
     id INTEGER PRIMARY KEY,          -- mismo id que en Laravel
     nombre TEXT NOT NULL,
     direccion TEXT,
     lat REAL NOT NULL,
     lng REAL NOT NULL,
     radio_m INTEGER NOT NULL,
     actualizada TEXT
   );
   CREATE TABLE IF NOT EXISTS condiciones_obra (
     obra_id INTEGER PRIMARY KEY,
     datos TEXT NOT NULL,             -- JSON tal como lo entrega la API
     guardado_en TEXT NOT NULL        -- cuándo se descargó (para mostrar la antigüedad)
   );`,

  // v3: asistencias (entrada/salida). Solo se insertan; el sincronizador las envía.
  `CREATE TABLE IF NOT EXISTS asistencias (
     local_id TEXT PRIMARY KEY,       -- UUID; si se reenvía, Laravel lo reconoce y no lo duplica
     remote_id INTEGER,               -- id en MySQL (null hasta sincronizar)
     user_id INTEGER NOT NULL,        -- quién checó (solo se envían los del usuario con sesión)
     obra_id INTEGER NOT NULL,
     tipo TEXT NOT NULL,              -- entrada | salida
     registrado_en TEXT NOT NULL,     -- hora del teléfono (ISO, UTC)
     lat REAL NOT NULL,
     lng REAL NOT NULL,
     precision_m REAL,
     sync_status TEXT NOT NULL DEFAULT 'pending',  -- pending | synced | error | rechazado
     intentos INTEGER NOT NULL DEFAULT 0,
     ultimo_error TEXT,
     dentro_radio INTEGER,            -- lo decide el servidor (null hasta sincronizar)
     distancia_m INTEGER,
     reloj_sospechoso INTEGER,
     precision_baja INTEGER,
     updated_at TEXT NOT NULL
   );
   CREATE INDEX IF NOT EXISTS idx_asistencias_status ON asistencias (sync_status);
   CREATE INDEX IF NOT EXISTS idx_asistencias_usuario_fecha ON asistencias (user_id, registrado_en);`,

  // v4: bitácora de obra (CRUD completo sin señal). Los cambios propios se suben y los de
  // la cuadrilla se bajan. Conflicto: si dos editan la misma nota, gana la edición más reciente.
  `CREATE TABLE IF NOT EXISTS bitacora (
     local_id TEXT PRIMARY KEY,       -- UUID (el mismo en Laravel)
     remote_id INTEGER,               -- id en MySQL (null hasta sincronizar)
     obra_id INTEGER NOT NULL,
     autor_id INTEGER NOT NULL,
     autor_nombre TEXT,
     editado_por_id INTEGER,
     editado_por_nombre TEXT,
     categoria TEXT NOT NULL,         -- avance | incidencia | material | seguridad
     titulo TEXT NOT NULL,
     descripcion TEXT,
     fecha TEXT NOT NULL,             -- día de la nota (YYYY-MM-DD)
     editado_en TEXT NOT NULL,        -- última edición (ISO, UTC); decide los conflictos
     eliminado INTEGER NOT NULL DEFAULT 0,  -- borrar = marcar, para que el borrado también se sincronice
     sync_status TEXT NOT NULL DEFAULT 'synced',  -- synced | pending | error | rechazado
     pendiente_de INTEGER,            -- quién hizo el cambio local (solo esa sesión lo envía)
     intentos INTEGER NOT NULL DEFAULT 0,
     ultimo_error TEXT,
     conflicto INTEGER NOT NULL DEFAULT 0   -- 1 = tu edición perdió contra una más reciente
   );
   CREATE INDEX IF NOT EXISTS idx_bitacora_obra_fecha ON bitacora (obra_id, fecha);
   CREATE INDEX IF NOT EXISTS idx_bitacora_status ON bitacora (sync_status);`,
];

/** Conexión única a SQLite (en el teléfono es nativo; en el navegador usa jeep-sqlite). */
@Injectable({ providedIn: 'root' })
export class Database {

  private sqlite = new SQLiteConnection(CapacitorSQLite);
  private db!: SQLiteDBConnection;

  /** Abre la base y aplica las migraciones pendientes. Se llama una vez al arrancar la app. */
  async inicializar() {
    const existe = (await this.sqlite.isConnection(DB_NAME, false)).result;
    this.db = existe
      ? await this.sqlite.retrieveConnection(DB_NAME, false)
      : await this.sqlite.createConnection(DB_NAME, false, 'no-encryption', 1, false);

    await this.db.open();
    await this.migrar();
  }

  /** Conexión abierta, para los repositorios de cada módulo. */
  get conexion(): SQLiteDBConnection {
    return this.db;
  }

  /** Lee la versión actual y aplica, en orden, las migraciones que faltan. */
  private async migrar() {
    const res = await this.db.query('PRAGMA user_version;');
    const actual = Number(res.values?.[0]?.user_version ?? 0);

    for (let v = actual; v < MIGRACIONES.length; v++) {
      await this.db.execute(MIGRACIONES[v]);
      await this.db.execute(`PRAGMA user_version = ${v + 1};`);
      console.log(`Base local migrada a v${v + 1}`);
    }
  }
}
