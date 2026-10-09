<?php

namespace Database\Seeders;

use App\Enums\Rol;
use App\Models\User;
use Illuminate\Database\Seeder;

class UserSeeder extends Seeder
{
    /**
     * Cuentas de demostración (contraseña: "password"). Solo para desarrollo y demos.
     */
    public function run(): void
    {
        $usuarios = [
            ['name' => 'Laura Méndez', 'email' => 'admin@obrasync.test', 'rol' => Rol::Admin],
            ['name' => 'Carlos Ramírez', 'email' => 'mayordomo@obrasync.test', 'rol' => Rol::Mayordomo],
            ['name' => 'Juan Pérez', 'email' => 'trabajador@obrasync.test', 'rol' => Rol::Trabajador],
            ['name' => 'Miguel Torres', 'email' => 'trabajador2@obrasync.test', 'rol' => Rol::Trabajador],
        ];

        foreach ($usuarios as $u) {
            User::updateOrCreate(
                ['email' => $u['email']],
                $u + ['password' => 'password', 'activo' => true, 'email_verified_at' => now()]
            );
        }
    }
}
