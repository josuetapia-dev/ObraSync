<?php

namespace Tests\Unit;

use App\Support\IndiceCalor;
use PHPUnit\Framework\TestCase;

class IndiceCalorTest extends TestCase
{
    public function test_con_calor_y_humedad_se_siente_mucho_mas_caliente(): void
    {
        // Tabla NOAA: 90 °F con 70 % de humedad ≈ 106 °F (41 °C).
        $this->assertEqualsWithDelta(41.0, IndiceCalor::calcular(32.2, 70), 0.6);
    }

    public function test_con_clima_templado_casi_no_cambia(): void
    {
        $this->assertEqualsWithDelta(24.0, IndiceCalor::calcular(24.0, 40), 1.0);
    }

    public function test_humedad_fuera_de_rango_se_limita(): void
    {
        $this->assertSame(IndiceCalor::calcular(30, 100), IndiceCalor::calcular(30, 150));
    }
}
