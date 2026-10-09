import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
import { defineCustomElements as jeepSqlite } from 'jeep-sqlite/loader';

import { AppModule } from './app/app.module';

// Registra el componente <jeep-sqlite>, que permite usar SQLite dentro del navegador.
// En Android/iOS no se usa: ahí SQLite es nativo.
jeepSqlite(window);

platformBrowserDynamic().bootstrapModule(AppModule)
  .catch(err => console.log(err));
