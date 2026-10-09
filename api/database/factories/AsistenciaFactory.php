<?php

namespace Database\Factories;

use App\Enums\TipoAsistencia;
use App\Models\Obra;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Asistencia>
 */
class AsistenciaFactory extends Factory
{
    public function definition(): array
    {
        return [
            'uuid' => (string) Str::uuid(),
            'user_id' => User::factory(),
            'obra_id' => Obra::factory(),
            'tipo' => TipoAsistencia::Entrada,
            'registrado_en' => now(),
            'lat' => 19.9312,
            'lng' => -96.8504,
            'precision_m' => 15,
            'distancia_m' => 0,
            'dentro_radio' => true,
            'desfase_reloj_seg' => 0,
        ];
    }
}
