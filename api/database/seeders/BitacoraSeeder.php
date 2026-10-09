<?php

namespace Database\Seeders;

use App\Enums\CategoriaBitacora;
use App\Models\Bitacora;
use App\Models\Obra;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class BitacoraSeeder extends Seeder
{
    /** Algunas notas de ejemplo en la obra de Misantla (para la demo). */
    public function run(): void
    {
        $obra = Obra::where('nombre', 'Nave industrial Misantla')->first();
        $mayordomo = User::where('email', 'mayordomo@obrasync.test')->first();
        $trabajador = User::where('email', 'trabajador@obrasync.test')->first();
        if (! $obra || ! $mayordomo || ! $trabajador) {
            return;
        }

        $notas = [
            [$mayordomo, CategoriaBitacora::Avance, 'Colado de zapatas eje A terminado', 'Se colaron 6 zapatas con concreto f\'c 250. Curado con agua por 7 días.', 2],
            [$trabajador, CategoriaBitacora::Material, 'Faltan 40 bultos de cemento', 'Para el firme del área de carga. Solicitar al proveedor antes del jueves.', 1],
            [$mayordomo, CategoriaBitacora::Seguridad, 'Charla de 5 minutos: trabajo en alturas', 'Asistieron 12 trabajadores. Se revisaron arneses y líneas de vida.', 1],
            [$trabajador, CategoriaBitacora::Incidencia, 'Fuga en toma de agua provisional', 'Se cerró la llave general. Falta cambiar el codo de 1/2".', 0],
        ];

        foreach ($notas as [$autor, $categoria, $titulo, $descripcion, $diasAtras]) {
            Bitacora::firstOrCreate(['titulo' => $titulo, 'obra_id' => $obra->id], [
                'uuid' => (string) Str::uuid(),
                'user_id' => $autor->id,
                'editado_por' => $autor->id,
                'categoria' => $categoria,
                'descripcion' => $descripcion,
                'fecha' => today()->subDays($diasAtras),
                'editado_en' => now()->subDays($diasAtras),
            ]);
        }
    }
}
