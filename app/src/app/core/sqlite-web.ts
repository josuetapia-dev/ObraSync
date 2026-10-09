import { Capacitor } from '@capacitor/core';
import { CapacitorSQLite } from '@capacitor-community/sqlite';

/**
 * En el navegador, SQLite vive dentro del componente <jeep-sqlite> y guarda los datos
 * en IndexedDB. Hay que agregarlo a la página e iniciar su almacén antes de abrir la base.
 * En Android/iOS no hace nada: ahí SQLite es nativo.
 */
export async function prepararSqliteWeb() {
  if (Capacitor.getPlatform() !== 'web') return;

  const jeep = document.createElement('jeep-sqlite') as HTMLElement & { autoSave: boolean };
  jeep.autoSave = true; // guarda en IndexedDB después de cada cambio (si no, se pierde al recargar)
  document.body.appendChild(jeep);

  await customElements.whenDefined('jeep-sqlite');
  await CapacitorSQLite.initWebStore();
}
