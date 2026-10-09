<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Venta extends Model
{
    protected $table = 'ventas';

    protected $fillable = ['dispositivo_id', 'local_id', 'total', 'fecha'];

    protected $casts = [
        'total' => 'float',
        'fecha' => 'datetime',
    ];

    /** Productos de la venta. */
    public function detalles(): HasMany
    {
        return $this->hasMany(DetalleVenta::class);
    }
}
