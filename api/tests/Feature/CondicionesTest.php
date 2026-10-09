<?php

namespace Tests\Feature;

use App\Models\Obra;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class CondicionesTest extends TestCase
{
    use RefreshDatabase;

    private User $mayordomo;

    private Obra $obra;

    protected function setUp(): void
    {
        parent::setUp();
        config(['services.openweather.key' => 'key-de-prueba']);

        $this->mayordomo = User::factory()->mayordomo()->create();
        $this->obra = Obra::factory()->create();
        $this->mayordomo->obras()->attach($this->obra);
    }

    /** Bloque de pronóstico con el formato de OpenWeather /forecast. */
    private function bloque(float $temp, int $humedad, float $pop, float $rafagaMs, int $dt = 1791525600): array
    {
        return [
            'dt' => $dt,
            'main' => ['temp' => $temp, 'feels_like' => $temp + 2, 'humidity' => $humedad],
            'weather' => [['id' => 500, 'description' => 'lluvia ligera']],
            'wind' => ['speed' => $rafagaMs / 2, 'gust' => $rafagaMs],
            'pop' => $pop,
        ];
    }

    private function fingirPronostico(array $lista, int $status = 200): void
    {
        Http::fake(['api.openweathermap.org/*' => Http::response(['cod' => '200', 'list' => $lista], $status)]);
    }

    public function test_dia_peligroso_todo_en_rojo(): void
    {
        // 34 °C con 70 % (índice ~46 °C), 75 % de lluvia, ráfagas de 12 m/s (43 km/h).
        $this->fingirPronostico([$this->bloque(34, 70, 0.75, 12), $this->bloque(33, 65, 0.4, 8)]);

        $res = $this->actingAs($this->mayordomo)->getJson("/api/obras/{$this->obra->id}/condiciones")->assertOk();

        $res->assertJsonPath('data.nivel', 'rojo')
            ->assertJsonPath('data.riesgos.calor.nivel', 'rojo')
            ->assertJsonPath('data.riesgos.lluvia.nivel', 'rojo')
            ->assertJsonPath('data.riesgos.lluvia.valor', 75)
            ->assertJsonPath('data.riesgos.viento.nivel', 'rojo')
            ->assertJsonPath('data.riesgos.viento.valor', 43)
            ->assertJsonStructure(['data' => ['actualizado', 'ahora' => ['temp', 'sensacion', 'humedad', 'descripcion'], 'proximas_horas' => [['hora', 'temp', 'prob_lluvia', 'rafaga_kmh']]]]);

        Http::assertSent(fn ($req) => str_contains($req->url(), 'appid=key-de-prueba')
            && str_contains($req->url(), 'units=metric'));
    }

    public function test_dia_tranquilo_todo_en_verde(): void
    {
        $this->fingirPronostico([$this->bloque(22, 50, 0.05, 3), $this->bloque(23, 50, 0.1, 4)]);

        $this->actingAs($this->mayordomo)->getJson("/api/obras/{$this->obra->id}/condiciones")
            ->assertOk()
            ->assertJsonPath('data.nivel', 'verde')
            ->assertJsonPath('data.riesgos.calor.nivel', 'verde')
            ->assertJsonPath('data.riesgos.lluvia.nivel', 'verde')
            ->assertJsonPath('data.riesgos.viento.nivel', 'verde');
    }

    public function test_umbrales_amarillos(): void
    {
        // Índice ~29 °C, 40 % de lluvia, ráfaga 7 m/s (25 km/h).
        $this->fingirPronostico([$this->bloque(28, 50, 0.4, 7), $this->bloque(27, 50, 0.2, 5)]);

        $this->actingAs($this->mayordomo)->getJson("/api/obras/{$this->obra->id}/condiciones")
            ->assertJsonPath('data.nivel', 'amarillo')
            ->assertJsonPath('data.riesgos.calor.nivel', 'amarillo')
            ->assertJsonPath('data.riesgos.lluvia.nivel', 'amarillo')
            ->assertJsonPath('data.riesgos.viento.nivel', 'amarillo');
    }

    public function test_usa_cache_y_no_vuelve_a_llamar_a_openweather(): void
    {
        $this->fingirPronostico([$this->bloque(25, 60, 0, 3), $this->bloque(25, 60, 0, 3)]);

        $this->actingAs($this->mayordomo)->getJson("/api/obras/{$this->obra->id}/condiciones")->assertOk();
        $this->actingAs($this->mayordomo)->getJson("/api/obras/{$this->obra->id}/condiciones")->assertOk();

        Http::assertSentCount(1);
    }

    public function test_si_openweather_falla_responde_503(): void
    {
        $this->fingirPronostico([], 500);

        $this->actingAs($this->mayordomo)->getJson("/api/obras/{$this->obra->id}/condiciones")
            ->assertStatus(503)
            ->assertJsonPath('message', 'El clima no está disponible por ahora.');
    }

    public function test_sin_key_configurada_responde_503(): void
    {
        config(['services.openweather.key' => null]);
        Http::fake();

        $this->actingAs($this->mayordomo)->getJson("/api/obras/{$this->obra->id}/condiciones")->assertStatus(503);
        Http::assertNothingSent();
    }

    public function test_no_puede_ver_condiciones_de_obra_ajena(): void
    {
        Http::fake();
        $ajena = Obra::factory()->create();

        $this->actingAs($this->mayordomo)->getJson("/api/obras/{$ajena->id}/condiciones")->assertForbidden();
        Http::assertNothingSent();
    }
}
