<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Obra extends Model
{
    /** @use HasFactory<\Database\Factories\ObraFactory> */
    use HasFactory;

    protected $fillable = ['nombre', 'direccion', 'lat', 'lng', 'radio_m', 'activa'];

    protected function casts(): array
    {
        return [
            'lat' => 'float',
            'lng' => 'float',
            'radio_m' => 'integer',
            'activa' => 'boolean',
        ];
    }

    /** Personal asignado a la obra. */
    public function usuarios(): BelongsToMany
    {
        return $this->belongsToMany(User::class)->withTimestamps();
    }

    /** Solo obras activas. */
    public function scopeActivas(Builder $query): void
    {
        $query->where('activa', true);
    }
}
