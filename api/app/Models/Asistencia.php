<?php

namespace App\Models;

use App\Enums\TipoAsistencia;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Asistencia extends Model
{
    /** @use HasFactory<\Database\Factories\AsistenciaFactory> */
    use HasFactory;

    protected $fillable = [
        'uuid', 'user_id', 'obra_id', 'tipo', 'registrado_en', 'lat', 'lng', 'precision_m',
        'distancia_m', 'dentro_radio', 'desfase_reloj_seg', 'reloj_sospechoso', 'precision_baja', 'dispositivo',
    ];

    protected function casts(): array
    {
        return [
            'tipo' => TipoAsistencia::class,
            'registrado_en' => 'datetime',
            'lat' => 'float',
            'lng' => 'float',
            'precision_m' => 'float',
            'distancia_m' => 'integer',
            'dentro_radio' => 'boolean',
            'desfase_reloj_seg' => 'integer',
            'reloj_sospechoso' => 'boolean',
            'precision_baja' => 'boolean',
        ];
    }

    public function usuario(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function obra(): BelongsTo
    {
        return $this->belongsTo(Obra::class);
    }
}
