<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\ObraController;
use Illuminate\Support\Facades\Route;

// Rutas de la API (prefijo /api). Las consume la app Ionic de ObraSync.

// Comprobación rápida de que la API está arriba.
Route::get('/salud', fn () => ['ok' => true, 'app' => config('app.name')]);

// Autenticación (máximo 5 intentos por minuto por correo + IP).
Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:login');

// Todo lo de aquí requiere un token válido (Authorization: Bearer ...).
Route::middleware('auth:sanctum')->group(function () {
    Route::get('/me', [AuthController::class, 'me']);
    Route::post('/logout', [AuthController::class, 'logout']);

    // Obras asignadas (el admin ve todas).
    Route::get('/obras', [ObraController::class, 'index']);
    Route::get('/obras/{obra}', [ObraController::class, 'show']);
});
