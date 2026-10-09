<?php

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Obra>
 */
class ObraFactory extends Factory
{
    public function definition(): array
    {
        return [
            'nombre' => 'Obra '.fake()->unique()->city(),
            'direccion' => fake()->streetAddress(),
            'lat' => fake()->latitude(19, 21),
            'lng' => fake()->longitude(-98, -96),
            'radio_m' => 150,
            'activa' => true,
        ];
    }

    public function inactiva(): static
    {
        return $this->state(fn () => ['activa' => false]);
    }
}
