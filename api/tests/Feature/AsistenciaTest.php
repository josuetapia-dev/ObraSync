<?php

namespace Tests\Feature;

use App\Models\Asistencia;
use App\Models\Obra;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class AsistenciaTest extends TestCase
{
    use RefreshDatabase;

    private User $trabajador;

    private Obra $obra;

    protected function setUp(): void
    {
        parent::setUp();
        $this->trabajador = User::factory()->create();
        $this->obra = Obra::factory()->create(['lat' => 19.9312, 'lng' => -96.8504, 'radio_m' => 200]);
        $this->trabajador->obras()->attach($this->obra);
    }

    private function registro(array $cambios = []): array
    {
        return array_merge([
            'uuid' => (string) Str::uuid(),
            'obra_id' => $this->obra->id,
            'tipo' => 'entrada',
            'registrado_en' => now()->subMinutes(10)->toIso8601String(),
            'lat' => 19.9313,
            'lng' => -96.8505,
            'precision_m' => 12,
        ], $cambios);
    }

    private function sincronizar(array $registros, array $extra = [])
    {
        return $this->actingAs($this->trabajador)->postJson('/api/asistencias/sync', array_merge([
            'enviado_en' => now()->toIso8601String(),
            'dispositivo' => 'Prueba',
            'registros' => $registros,
        ], $extra));
    }

    public function test_requiere_sesion(): void
    {
        $this->postJson('/api/asistencias/sync', [])->assertUnauthorized();
    }

    public function test_registra_entrada_dentro_del_radio(): void
    {
        $r = $this->registro();

        $this->sincronizar([$r])
            ->assertOk()
            ->assertJsonPath('resultados.0.uuid', $r['uuid'])
            ->assertJsonPath('resultados.0.estado', 'creado')
            ->assertJsonPath('resultados.0.dentro_radio', true)
            ->assertJsonPath('resultados.0.reloj_sospechoso', false);

        $this->assertDatabaseHas('asistencias', ['uuid' => $r['uuid'], 'user_id' => $this->trabajador->id, 'tipo' => 'entrada']);
    }

    public function test_reenviar_el_mismo_registro_no_lo_duplica(): void
    {
        $r = $this->registro();

        $this->sincronizar([$r])->assertJsonPath('resultados.0.estado', 'creado');
        $this->sincronizar([$r])->assertJsonPath('resultados.0.estado', 'duplicado');

        $this->assertSame(1, Asistencia::count());
    }

    public function test_fuera_del_radio_se_registra_pero_marcado(): void
    {
        // ~1 km al norte de la obra.
        $this->sincronizar([$this->registro(['lat' => 19.9402])])
            ->assertJsonPath('resultados.0.estado', 'creado')
            ->assertJsonPath('resultados.0.dentro_radio', false)
            ->assertJsonPath('resultados.0.distancia_m', fn ($d) => $d > 900 && $d < 1100);
    }

    public function test_el_servidor_calcula_la_distancia_aunque_la_app_mande_otra_cosa(): void
    {
        // La app no puede decir "estoy dentro": campos extra se ignoran.
        $this->sincronizar([$this->registro(['lat' => 19.9500, 'dentro_radio' => true, 'distancia_m' => 0])])
            ->assertJsonPath('resultados.0.dentro_radio', false);
    }

    public function test_reloj_del_telefono_adelantado_se_marca_y_se_corrige(): void
    {
        // El teléfono cree que son 2 h más tarde de lo real.
        $adelanto = now()->addHours(2);
        $registradoTel = $adelanto->copy()->subMinutes(5);

        $res = $this->sincronizar(
            [$this->registro(['registrado_en' => $registradoTel->toIso8601String()])],
            ['enviado_en' => $adelanto->toIso8601String()]
        )->assertJsonPath('resultados.0.reloj_sospechoso', true);

        // Se guarda la hora corregida (≈ hace 5 min, hora real).
        $guardada = Asistencia::first()->registrado_en;
        $this->assertEqualsWithDelta(now()->subMinutes(5)->timestamp, $guardada->timestamp, 5);
        $this->assertEqualsWithDelta(-7200, $res->json('desfase_reloj_seg'), 5);
    }

    public function test_registro_hecho_sin_senal_horas_antes_no_es_sospechoso(): void
    {
        // Se checó hace 6 h sin señal y se envía ahora con el reloj correcto.
        $this->sincronizar([$this->registro(['registrado_en' => now()->subHours(6)->toIso8601String()])])
            ->assertJsonPath('resultados.0.reloj_sospechoso', false);
    }

    public function test_precision_baja_se_marca(): void
    {
        $this->sincronizar([$this->registro(['precision_m' => 350])])
            ->assertJsonPath('resultados.0.precision_baja', true);
    }

    public function test_obra_no_asignada_se_rechaza_solo_ese_registro(): void
    {
        $ajena = Obra::factory()->create();

        $res = $this->sincronizar([$this->registro(), $this->registro(['obra_id' => $ajena->id])])->assertOk();

        $res->assertJsonPath('resultados.0.estado', 'creado')
            ->assertJsonPath('resultados.1.estado', 'rechazado');
        $this->assertSame(1, Asistencia::count());
    }

    public function test_valida_los_datos(): void
    {
        $this->sincronizar([$this->registro(['tipo' => 'comida', 'lat' => 200, 'uuid' => 'no-es-uuid'])])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['registros.0.tipo', 'registros.0.lat', 'registros.0.uuid']);
    }

    public function test_trabajador_solo_ve_sus_registros_y_mayordomo_los_de_la_obra(): void
    {
        $companero = User::factory()->create();
        $companero->obras()->attach($this->obra);
        $mayordomo = User::factory()->mayordomo()->create();
        $mayordomo->obras()->attach($this->obra);

        Asistencia::factory()->create(['user_id' => $this->trabajador->id, 'obra_id' => $this->obra->id]);
        Asistencia::factory()->create(['user_id' => $companero->id, 'obra_id' => $this->obra->id]);

        $this->actingAs($this->trabajador)->getJson("/api/asistencias?obra_id={$this->obra->id}")
            ->assertOk()->assertJsonCount(1, 'data');

        $this->actingAs($mayordomo)->getJson("/api/asistencias?obra_id={$this->obra->id}")
            ->assertOk()->assertJsonCount(2, 'data')
            ->assertJsonStructure(['data' => [['usuario' => ['id', 'nombre'], 'dentro_radio', 'distancia_m']]]);
    }
}
