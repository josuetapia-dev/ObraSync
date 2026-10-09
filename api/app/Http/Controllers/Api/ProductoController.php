<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Producto;

class ProductoController extends Controller
{
    /** GET /api/productos — catálogo que la app guarda en SQLite para vender sin internet. */
    public function index()
    {
        return Producto::orderBy('nombre')->get(['id', 'nombre', 'descripcion', 'precio']);
    }
}
