<?php

namespace App\Enums;

/**
 * Roles de ObraSync.
 * - Trabajador: checa entrada/salida en sus obras y escribe bitácoras.
 * - Mayordomo: lo anterior + reporte diario y asistencia de su cuadrilla.
 * - Admin: oficina; obras, usuarios, asignaciones y aprobación de ajustes.
 */
enum Rol: string
{
    case Trabajador = 'trabajador';
    case Mayordomo = 'mayordomo';
    case Admin = 'admin';

    public function etiqueta(): string
    {
        return match ($this) {
            self::Trabajador => 'Trabajador',
            self::Mayordomo => 'Mayordomo',
            self::Admin => 'Administrador',
        };
    }
}
