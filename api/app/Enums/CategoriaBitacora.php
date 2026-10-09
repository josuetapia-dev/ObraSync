<?php

namespace App\Enums;

enum CategoriaBitacora: string
{
    case Avance = 'avance';
    case Incidencia = 'incidencia';
    case Material = 'material';
    case Seguridad = 'seguridad';

    public function etiqueta(): string
    {
        return match ($this) {
            self::Avance => 'Avance',
            self::Incidencia => 'Incidencia',
            self::Material => 'Material',
            self::Seguridad => 'Seguridad',
        };
    }
}
