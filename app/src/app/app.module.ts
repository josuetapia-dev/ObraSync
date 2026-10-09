import { LOCALE_ID, NgModule, inject, provideAppInitializer } from '@angular/core';
import { registerLocaleData } from '@angular/common';
import localeEsMx from '@angular/common/locales/es-MX';
import { BrowserModule } from '@angular/platform-browser';
import { provideHttpClient } from '@angular/common/http';
import { RouteReuseStrategy } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { CapacitorSQLite } from '@capacitor-community/sqlite';

import { IonicModule, IonicRouteStrategy } from '@ionic/angular/lazy';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { Database } from './services/database';
import { Estado } from './services/estado';
import { precargarComponentes, registrarIconos } from './offline-assets';

// Fechas y números en español (pipes | date y | currency).
registerLocaleData(localeEsMx);

// Iconos incluidos en la app (no se descargan de la red; funcionan offline).
registrarIconos();

/**
 * En el navegador, SQLite vive dentro del componente <jeep-sqlite> y guarda los datos
 * en IndexedDB. Hay que agregarlo a la página e iniciar su almacén antes de abrir la base.
 */
async function prepararSqliteWeb() {
  if (Capacitor.getPlatform() !== 'web') return;

  const jeep = document.createElement('jeep-sqlite') as HTMLElement & { autoSave: boolean };
  jeep.autoSave = true; // guarda en IndexedDB después de cada cambio (si no, se pierde al recargar)
  document.body.appendChild(jeep);

  await customElements.whenDefined('jeep-sqlite');
  await CapacitorSQLite.initWebStore();
}

@NgModule({
  declarations: [AppComponent],
  imports: [BrowserModule, IonicModule.forRoot(), AppRoutingModule],
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    // Habilita HttpClient para enviar las ventas a la API de Laravel.
    provideHttpClient(),
    { provide: LOCALE_ID, useValue: 'es-MX' },
    // Antes de mostrar la app: prepara SQLite (en web) y crea/abre la base local.
    provideAppInitializer(async () => {
      const database = inject(Database);
      const estado = inject(Estado);
      precargarComponentes(); // en segundo plano, mientras hay red
      await prepararSqliteWeb();
      await database.inicializarBD();
      await estado.refrescarPendientes();
      estado.sincronizar(); // si hay red, envía lo que quedó pendiente (sin bloquear el arranque)
    }),
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}
