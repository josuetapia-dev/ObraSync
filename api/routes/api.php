<?php

use Illuminate\Support\Facades\Route;

// Rutas de la API (prefijo /api). Las consume la app Ionic de ObraSync.

// Comprobación rápida de que la API está arriba.
Route::get('/salud', fn () => ['ok' => true, 'app' => config('app.name')]);
