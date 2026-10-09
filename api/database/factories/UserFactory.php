<?php

namespace Database\Factories;

use App\Enums\Rol;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\User>
 */
class UserFactory extends Factory
{
    /**
     * The current password being used by the factory.
     */
    protected static ?string $password;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'name' => fake()->name(),
            'email' => fake()->unique()->safeEmail(),
            'email_verified_at' => now(),
            'password' => static::$password ??= Hash::make('password'),
            'remember_token' => Str::random(10),
            'rol' => Rol::Trabajador,
            'activo' => true,
        ];
    }

    public function mayordomo(): static
    {
        return $this->state(fn () => ['rol' => Rol::Mayordomo]);
    }

    public function admin(): static
    {
        return $this->state(fn () => ['rol' => Rol::Admin]);
    }

    public function inactivo(): static
    {
        return $this->state(fn () => ['activo' => false]);
    }

    /**
     * Indicate that the model's email address should be unverified.
     */
    public function unverified(): static
    {
        return $this->state(fn (array $attributes) => [
            'email_verified_at' => null,
        ]);
    }
}
