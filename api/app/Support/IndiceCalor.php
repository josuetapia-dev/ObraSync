<?php

namespace App\Support;

/**
 * Índice de calor ("sensación térmica por humedad") según la fórmula de la NOAA
 * (regresión de Rothfusz con sus ajustes). Es lo que usan las guías de prevención
 * de golpe de calor: con humedad alta, 32 °C se sienten como 40 °C o más.
 *
 * https://www.wpc.ncep.noaa.gov/html/heatindex_equation.shtml
 */
final class IndiceCalor
{
    /** @return float índice de calor en °C */
    public static function calcular(float $temperaturaC, float $humedad): float
    {
        $t = $temperaturaC * 9 / 5 + 32; // la fórmula trabaja en °F
        $h = max(0.0, min(100.0, $humedad));

        // Fórmula simple; si da menos de 80 °F se usa tal cual.
        $hi = 0.5 * ($t + 61.0 + (($t - 68.0) * 1.2) + ($h * 0.094));

        if (($hi + $t) / 2 >= 80) {
            $hi = -42.379 + 2.04901523 * $t + 10.14333127 * $h
                - 0.22475541 * $t * $h - 0.00683783 * $t * $t
                - 0.05481717 * $h * $h + 0.00122874 * $t * $t * $h
                + 0.00085282 * $t * $h * $h - 0.00000199 * $t * $t * $h * $h;

            if ($h < 13 && $t >= 80 && $t <= 112) {
                $hi -= ((13 - $h) / 4) * sqrt((17 - abs($t - 95)) / 17);
            } elseif ($h > 85 && $t >= 80 && $t <= 87) {
                $hi += (($h - 85) / 10) * ((87 - $t) / 5);
            }
        }

        return round(($hi - 32) * 5 / 9, 1);
    }
}
