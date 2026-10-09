import { Injectable } from '@angular/core';
import {
  CapacitorSQLite,
  SQLiteConnection,
  SQLiteDBConnection,
} from '@capacitor-community/sqlite';

const DB_NAME = 'obrasync';

/**
 * Migraciones de la base local. Cada módulo agrega la suya al final de la lista
 * (nunca se edita una que ya existe). La versión aplicada se guarda en PRAGMA user_version,
 * así cada teléfono solo ejecuta las que le faltan.
 */
const MIGRACIONES: string[] = [
  // v1: tabla clave/valor para datos sueltos (p. ej. fecha de la última sincronización).
  `CREATE TABLE IF NOT EXISTS meta (
     clave TEXT PRIMARY KEY,
     valor TEXT
   );`,

  // v2: caché de obras asignadas y de sus condiciones (cache-first, funciona offline).
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

  // v3: asistencias. Se guardan aquí primero (sin señal) y el sincronizador las envía.
  `CREATE TABLE IF NOT EXISTS asistencias (
     local_id TEXT PRIMARY KEY,       -- UUID del teléfono; también es la llave anti-duplicados en Laravel
     remote_id INTEGER,               -- id que asignó Laravel
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
