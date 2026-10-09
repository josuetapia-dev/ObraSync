import { LOCALE_ID, NgModule, inject, provideAppInitializer } from '@angular/core';
import { registerLocaleData } from '@angular/common';
import localeEsMx from '@angular/common/locales/es-MX';
import { BrowserModule } from '@angular/platform-browser';
import { provideHttpClient } from '@angular/common/http';
import { RouteReuseStrategy } from '@angular/router';

import { IonicModule, IonicRouteStrategy } from '@ionic/angular/lazy';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { Database } from './core/database';
import { prepararSqliteWeb } from './core/sqlite-web';
import { precargarComponentes, registrarIconos } from './core/offline-assets';

// Fechas y números en español de México (pipes | date y | currency).
registerLocaleData(localeEsMx);

// Iconos incluidos en la app (no se descargan de la red; funcionan offline).
registrarIconos();

@NgModule({
  declarations: [AppComponent],
  imports: [BrowserModule, IonicModule.forRoot(), AppRoutingModule],
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    provideHttpClient(),
    { provide: LOCALE_ID, useValue: 'es-MX' },
    // Antes de mostrar la app: prepara SQLite (en web) y abre/migra la base local.
    provideAppInitializer(async () => {
      const database = inject(Database);
      precargarComponentes(); // en segundo plano, mientras hay red
      await prepararSqliteWeb();
      await database.inicializar();
    }),
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}
