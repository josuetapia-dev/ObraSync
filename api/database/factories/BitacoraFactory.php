<?php

namespace Database\Factories;

use App\Enums\CategoriaBitacora;
use App\Models\Obra;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Bitacora>
 */
class BitacoraFactory extends Factory
{
    public function definition(): array
    {
        return [
            'uuid' => (string) Str::uuid(),
            'obra_id' => Obra::factory(),
            'user_id' => User::factory(),
            'editado_por' => fn (array $a) => $a['user_id'],
            'categoria' => CategoriaBitacora::Avance,
            'titulo' => fake()->sentence(4),
            'descripcion' => fake()->paragraph(),
            'fecha' => today(),
            'editado_en' => now()->subHour(),
        ];
    }
}
