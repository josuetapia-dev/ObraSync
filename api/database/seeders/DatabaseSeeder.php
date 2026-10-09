<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Datos iniciales: catálogo de productos para el carrito.
     */
    public function run(): void
    {
        $this->call(ProductoSeeder::class);
    }
}
