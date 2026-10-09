<?php

namespace Database\Seeders;

use App\Models\Obra;
use App\Models\User;
use Illuminate\Database\Seeder;

class ObraSeeder extends Seeder
{
    /** Obras de ejemplo en el norte de Veracruz y su personal asignado. */
    public function run(): void
    {
        $obras = [
            'misantla' => ['nombre' => 'Nave industrial Misantla', 'direccion' => 'Carr. Misantla–Martínez de la Torre km 2, Misantla, Ver.', 'lat' => 19.9312, 'lng' => -96.8504, 'radio_m' => 200],
            'xalapa' => ['nombre' => 'Torre médica Xalapa', 'direccion' => 'Av. Lázaro Cárdenas 340, Xalapa, Ver.', 'lat' => 19.5438, 'lng' => -96.9102, 'radio_m' => 120],
            'gz' => ['nombre' => 'Unidad habitacional Gutiérrez Zamora', 'direccion' => 'Calle Hidalgo s/n, Gutiérrez Zamora, Ver.', 'lat' => 20.4522, 'lng' => -97.0841, 'radio_m' => 250],
            'papantla' => ['nombre' => 'Bodega de vainilla Papantla', 'direccion' => 'Blvd. Lázaro Cárdenas 85, Papantla, Ver.', 'lat' => 20.4472, 'lng' => -97.3200, 'radio_m' => 150],
        ];

        $creadas = [];
        foreach ($obras as $clave => $datos) {
            $creadas[$clave] = Obra::updateOrCreate(['nombre' => $datos['nombre']], $datos);
        }

        // Asignaciones: quién trabaja en qué obra.
        $asignar = [
            'mayordomo@obrasync.test' => ['misantla', 'gz', 'xalapa'],
            'trabajador@obrasync.test' => ['misantla', 'gz'],
            'trabajador2@obrasync.test' => ['xalapa'],
        ];

        foreach ($asignar as $email => $claves) {
            $usuario = User::where('email', $email)->first();
            $usuario?->obras()->syncWithoutDetaching(collect($claves)->map(fn ($c) => $creadas[$c]->id));
        }
    }
}
