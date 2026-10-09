<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Producto extends Model
{
    protected $fillable = ['nombre', 'descripcion', 'precio'];

    // Devuelve el precio como número en el JSON (no como texto "25.00").
    protected $casts = ['precio' => 'float'];
}
