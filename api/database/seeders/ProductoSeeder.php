<?php

namespace Database\Seeders;

use App\Models\Producto;
use Illuminate\Database\Seeder;

class ProductoSeeder extends Seeder
{
    /** Productos de ejemplo para el carrito. */
    public function run(): void
    {
        $productos = [
            ['nombre' => 'Café americano', 'descripcion' => 'Vaso de 355 ml', 'precio' => 35],
            ['nombre' => 'Capuchino', 'descripcion' => 'Vaso de 355 ml', 'precio' => 48],
            ['nombre' => 'Té chai', 'descripcion' => 'Vaso de 355 ml', 'precio' => 42],
            ['nombre' => 'Croissant', 'descripcion' => 'Mantequilla', 'precio' => 30],
            ['nombre' => 'Sándwich de pavo', 'descripcion' => 'Pan integral', 'precio' => 65],
            ['nombre' => 'Galleta de avena', 'descripcion' => 'Pieza', 'precio' => 18],
        ];

        foreach ($productos as $p) {
            Producto::updateOrCreate(['nombre' => $p['nombre']], $p);
        }
    }
}
