<?php

namespace Tests\Unit;

use App\Support\Geo;
use PHPUnit\Framework\TestCase;

class GeoTest extends TestCase
{
    public function test_distancia_entre_xalapa_y_misantla(): void
    {
        // ~43 km en línea recta.
        $d = Geo::distanciaMetros(19.5438, -96.9102, 19.9312, -96.8504);
        $this->assertEqualsWithDelta(43_500, $d, 1_000);
    }

    public function test_mismo_punto_es_cero(): void
    {
        $this->assertSame(0.0, Geo::distanciaMetros(19.93, -96.85, 19.93, -96.85));
    }

    public function test_cien_metros_al_norte(): void
    {
        // 0.0009° de latitud ≈ 100 m
        $this->assertEqualsWithDelta(100, Geo::distanciaMetros(19.9312, -96.8504, 19.9321, -96.8504), 2);
    }
}
