<?php

use App\Http\Controllers\Api\ProductoController;
use App\Http\Controllers\Api\VentaController;
use Illuminate\Support\Facades\Route;

// Rutas de la API (prefijo /api). Las consume la app Ionic.

// Catálogo de productos para el carrito.
Route::get('/productos', [ProductoController::class, 'index']);

// Ventas: la app envía aquí las ventas pendientes (sincronización).
Route::get('/ventas', [VentaController::class, 'index']);
Route::post('/ventas', [VentaController::class, 'store']);
