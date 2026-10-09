<?php

namespace App\Models;

use App\Enums\CategoriaBitacora;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Bitacora extends Model
{
    /** @use HasFactory<\Database\Factories\BitacoraFactory> */
    use HasFactory;

    protected $fillable = [
        'uuid', 'obra_id', 'user_id', 'editado_por', 'categoria', 'titulo', 'descripcion',
        'fecha', 'editado_en', 'eliminado_en',
    ];

    protected function casts(): array
    {
        return [
            'categoria' => CategoriaBitacora::class,
            'fecha' => 'date',
            'editado_en' => 'datetime',
            'eliminado_en' => 'datetime',
        ];
    }

    public function autor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function editor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'editado_por');
    }

    public function obra(): BelongsTo
    {
        return $this->belongsTo(Obra::class);
    }
}
