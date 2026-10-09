<?php

namespace App\Support;

final class Geo
{
    private const RADIO_TIERRA_M = 6_371_000;

    /** Distancia en metros entre dos coordenadas (fórmula de Haversine). */
    public static function distanciaMetros(float $lat1, float $lng1, float $lat2, float $lng2): float
    {
        $dLat = deg2rad($lat2 - $lat1);
        $dLng = deg2rad($lng2 - $lng1);

        $a = sin($dLat / 2) ** 2 + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLng / 2) ** 2;

        return self::RADIO_TIERRA_M * 2 * atan2(sqrt($a), sqrt(1 - $a));
    }
}
