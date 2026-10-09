# ObraSync

App **offline-first** para cuadrillas de construcción: checar entrada y salida con GPS, bitácora de obra y condiciones del clima por obra. Funciona **sin señal**: todo se guarda en el teléfono (SQLite) y se sincroniza con el servidor (Laravel + MySQL) cuando vuelve la conexión.

| Parte | Tecnología |
|---|---|
| App (`app/`) | Ionic 9 + Angular 22, Capacitor, SQLite (`@capacitor-community/sqlite`; en el navegador usa jeep-sqlite + IndexedDB) |
| API (`api/`) | Laravel 12, PHP 8.2, MySQL, Sanctum (tokens) |
| Servicios externos | OpenWeather (clima), OpenStreetMap + Leaflet (mapa) |

## Qué hace

- **Login con roles:** trabajador, mayordomo y admin. La sesión queda guardada para abrir la app sin señal.
- **Mis obras (cache-first):** se muestran al instante desde SQLite y se actualizan en segundo plano. Cada obra tiene un **semáforo de condiciones**: índice de calor, lluvia y ráfagas de las próximas 6 h.
- **Checar:** registra entrada y salida con GPS, muestra la distancia a la obra, la duración del turno y un historial. El **servidor** calcula si estabas dentro del radio y detecta relojes manipulados.
- **Bitácora:** CRUD offline con **búsqueda y filtros en SQLite**. Las notas se comparten con la cuadrilla. Si dos personas editan la misma nota, **gana la edición más reciente** y se avisa a quien perdió.

### Cómo sincroniza (patrón Outbox)

1. Cada cambio se guarda primero en SQLite con `sync_status = 'pending'` y un **UUID** generado en el teléfono (`local_id`).
2. El `Sincronizador` (`app/src/app/core/sync/`) envía los pendientes al abrir la app, al volver la red, cada 60 s o cuando el usuario lo pide.
3. Laravel responde **registro por registro** (creado, duplicado, conflicto o rechazado) y la app guarda el `remote_id`.
4. Si falla la red, el registro queda en `error` con `intentos + 1` y se reintenta después. El UUID evita duplicados al reenviar.

Las tablas locales y sus migraciones están en [`app/src/app/core/database.ts`](app/src/app/core/database.ts). Cada versión se aplica una sola vez gracias a `PRAGMA user_version`.

## Cómo correrlo en tu computadora

### Requisitos

- **PHP 8.2+** y **MySQL** (con [XAMPP](https://www.apachefriends.org/) basta)
- **Composer**
- **Node.js 22 o 24 (LTS)** y npm

### 1. API (Laravel)

```bash
cd api
composer install
cp .env.example .env
php artisan key:generate
```

1. Crea una base de datos vacía llamada **`obrasync`** en MySQL (por ejemplo, desde phpMyAdmin).
2. Revisa en `.env` que `DB_USERNAME` y `DB_PASSWORD` coincidan con tu MySQL (en XAMPP: `root` sin contraseña).
3. Crea las tablas y carga los datos de prueba, y arranca la API:

```bash
php artisan migrate --seed
php artisan serve
```

La API queda en `http://127.0.0.1:8000`. Para comprobarlo, abre `http://127.0.0.1:8000/api/salud`.

**Clima (opcional):** crea tu propia llave gratis en [openweathermap.org](https://openweathermap.org/api) y ponla en `.env` como `OPENWEATHER_KEY=...`. Sin llave todo funciona, salvo las condiciones de obra. **Nunca subas tu `.env` a GitHub**: ya está en `.gitignore`.

> Si Laravel va lento en XAMPP, activa OPcache en `C:\xampp\php\php.ini`: `zend_extension=opcache`, `opcache.enable=1`.

### 2. App (Ionic)

En otra terminal:

```bash
cd app
npm install
npx ng serve --port 8100
```

Abre `http://localhost:8100`. Para verla como en un celular: `F12` → icono de dispositivo móvil.

### Cuentas de prueba

Las crea el seeder. Contraseña de todas: **`password`**.

| Correo | Rol |
|---|---|
| `trabajador@obrasync.test` | Trabajador (obras de Misantla y Gutiérrez Zamora) |
| `trabajador2@obrasync.test` | Trabajador (Xalapa) |
| `mayordomo@obrasync.test` | Mayordomo (puede editar notas de su cuadrilla) |
| `admin@obrasync.test` | Admin (ve todas las obras) |

### Probar el modo sin conexión

1. En Chrome: `F12` → pestaña **Network** → **Offline**.
2. Crea una nota en **Bitácora** o checa en **Checar**: aparece "Sin enviar".
3. Quita **Offline**: se envía sola. Puedes verla en phpMyAdmin.
4. Los datos locales están en `F12` → **Application** → **IndexedDB** → `jeepSqliteStore`.

## Pruebas

```bash
cd api
php artisan test
```

Usan SQLite en memoria (no tocan tu base `obrasync`) y simulan OpenWeather.

## Estructura

```
api/
  app/Actions/          Lógica de negocio (RegistrarAsistencia, GuardarBitacora)
  app/Http/             Controladores, Form Requests y Resources
  app/Policies/         Quién puede ver o editar qué
  app/Services/         CondicionesObra (OpenWeather + semáforo)
  tests/                Pruebas de la API
app/src/app/
  core/                 SQLite, sesión, red y motor de sincronización
  features/             obras, asistencia, bitacora, auth, perfil
  shared/               Componentes reutilizables (semáforo, estado de red)
```

## Problemas comunes

| Problema | Solución |
|---|---|
| Login responde error 500 | MySQL no está encendido (XAMPP → Start MySQL) |
| "Demasiados intentos" al iniciar sesión | Límite de 5 por minuto: espera o corre `php artisan cache:clear` |
| La app se queda en blanco tras muchos cambios | Reinicia `ng serve` (`Ctrl + C` y vuelve a correrlo) |
| Condiciones de obra no aparecen | Falta `OPENWEATHER_KEY` en `api/.env` |
