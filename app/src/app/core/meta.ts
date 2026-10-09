import { Injectable, inject } from '@angular/core';

import { Database } from './database';

/** Valores sueltos guardados en SQLite (p. ej. "obras_actualizadas"). */
@Injectable({ providedIn: 'root' })
export class Meta {

  private database = inject(Database);

  async leer(clave: string): Promise<string | null> {
    const r = await this.database.conexion.query('SELECT valor FROM meta WHERE clave = ?', [clave]);
    return r.values?.[0]?.valor ?? null;
  }

  async guardar(clave: string, valor: string) {
    await this.database.conexion.run(
      'INSERT INTO meta (clave, valor) VALUES (?, ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor',
      [clave, valor]
    );
  }

  async borrar(clave: string) {
    await this.database.conexion.run('DELETE FROM meta WHERE clave = ?', [clave]);
  }
}
