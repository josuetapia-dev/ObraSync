<?php

namespace Tests\Feature;

use App\Models\Bitacora;
use App\Models\Obra;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class BitacoraTest extends TestCase
{
    use RefreshDatabase;

    private User $trabajador;

    private User $companero;

    private User $mayordomo;

    private Obra $obra;

    protected function setUp(): void
    {
        parent::setUp();
        $this->obra = Obra::factory()->create();
        $this->trabajador = User::factory()->create();
        $this->companero = User::factory()->create();
        $this->mayordomo = User::factory()->mayordomo()->create();
        foreach ([$this->trabajador, $this->companero, $this->mayordomo] as $u) {
            $u->obras()->attach($this->obra);
        }
    }

    private function cambio(array $cambios = []): array
    {
        return array_merge([
            'uuid' => (string) Str::uuid(),
            'obra_id' => $this->obra->id,
            'categoria' => 'avance',
            'titulo' => 'Colado de losa',
            'descripcion' => 'Segundo nivel, eje B',
            'fecha' => today()->toDateString(),
            'editado_en' => now()->subMinutes(5)->toIso8601String(),
            'eliminado' => false,
        ], $cambios);
    }

    private function sincronizar(User $usuario, array $cambios, array $extra = [])
    {
        return $this->actingAs($usuario)->postJson('/api/bitacora/sync', array_merge([
            'enviado_en' => now()->toIso8601String(),
            'cambios' => $cambios,
        ], $extra));
    }

    public function test_requiere_sesion(): void
    {
        $this->postJson('/api/bitacora/sync', [])->assertUnauthorized();
        $this->getJson('/api/bitacora')->assertUnauthorized();
    }

    public function test_crea_una_entrada(): void
    {
        $c = $this->cambio();

        $this->sincronizar($this->trabajador, [$c])
            ->assertOk()
            ->assertJsonPath('resultados.0.estado', 'aplicado')
            ->assertJsonPath('resultados.0.entrada.uuid', $c['uuid'])
            ->assertJsonPath('resultados.0.entrada.autor.id', $this->trabajador->id);

        $this->assertDatabaseHas('bitacoras', ['uuid' => $c['uuid'], 'user_id' => $this->trabajador->id, 'titulo' => 'Colado de losa']);
    }

    public function test_reenviar_el_mismo_cambio_no_duplica_ni_marca_conflicto(): void
    {
        $c = $this->cambio();

        $this->sincronizar($this->trabajador, [$c])->assertJsonPath('resultados.0.estado', 'aplicado');
        $this->sincronizar($this->trabajador, [$c])->assertJsonPath('resultados.0.estado', 'aplicado');

        $this->assertSame(1, Bitacora::count());
    }

    public function test_la_edicion_mas_reciente_gana(): void
    {
        $b = Bitacora::factory()->for($this->obra)->create([
            'user_id' => $this->trabajador->id, 'editado_por' => $this->trabajador->id, 'editado_en' => now()->subHour(),
        ]);

        $this->sincronizar($this->trabajador, [$this->cambio(['uuid' => $b->uuid, 'titulo' => 'Título nuevo'])])
            ->assertJsonPath('resultados.0.estado', 'aplicado');

        $this->assertSame('Título nuevo', $b->fresh()->titulo);
    }

    public function test_una_edicion_vieja_pierde_y_recibe_la_version_del_servidor(): void
    {
        // El mayordomo editó hace 1 min; el trabajador editó sin señal hace 30 min y apenas sincroniza.
        $b = Bitacora::factory()->for($this->obra)->create([
            'user_id' => $this->trabajador->id, 'editado_por' => $this->mayordomo->id,
            'titulo' => 'Versión del mayordomo', 'editado_en' => now()->subMinute(),
        ]);

        $this->sincronizar($this->trabajador, [$this->cambio([
            'uuid' => $b->uuid, 'titulo' => 'Versión vieja del trabajador', 'editado_en' => now()->subMinutes(30)->toIso8601String(),
        ])])
            ->assertJsonPath('resultados.0.estado', 'conflicto')
            ->assertJsonPath('resultados.0.entrada.titulo', 'Versión del mayordomo')
            ->assertJsonPath('resultados.0.entrada.editado_por.id', $this->mayordomo->id);

        $this->assertSame('Versión del mayordomo', $b->fresh()->titulo);
    }

    public function test_un_reloj_adelantado_no_gana_el_conflicto(): void
    {
        $b = Bitacora::factory()->for($this->obra)->create([
            'user_id' => $this->trabajador->id, 'editado_por' => $this->mayordomo->id,
            'titulo' => 'Versión del mayordomo', 'editado_en' => now()->subMinutes(10),
        ]);

        // El teléfono tiene el reloj 2 h adelantado: su edición "de hace 30 min" parece del futuro.
        $relojTelefono = now()->addHours(2);
        $this->sincronizar($this->trabajador, [$this->cambio([
            'uuid' => $b->uuid, 'titulo' => 'Reloj adelantado', 'editado_en' => $relojTelefono->copy()->subMinutes(30)->toIso8601String(),
        ])], ['enviado_en' => $relojTelefono->toIso8601String()])
            ->assertJsonPath('resultados.0.estado', 'conflicto');

        $this->assertSame('Versión del mayordomo', $b->fresh()->titulo);
    }

    public function test_un_trabajador_no_edita_la_entrada_de_otro(): void
    {
        $b = Bitacora::factory()->for($this->obra)->create(['user_id' => $this->companero->id, 'editado_por' => $this->companero->id]);

        $this->sincronizar($this->trabajador, [$this->cambio(['uuid' => $b->uuid, 'titulo' => 'No debería'])])
            ->assertJsonPath('resultados.0.estado', 'rechazado');

        $this->assertNotSame('No debería', $b->fresh()->titulo);
    }

    public function test_el_mayordomo_si_edita_entradas_de_su_obra(): void
    {
        $b = Bitacora::factory()->for($this->obra)->create(['user_id' => $this->trabajador->id, 'editado_por' => $this->trabajador->id]);

        $this->sincronizar($this->mayordomo, [$this->cambio(['uuid' => $b->uuid, 'titulo' => 'Corregido por el mayordomo'])])
            ->assertJsonPath('resultados.0.estado', 'aplicado')
            ->assertJsonPath('resultados.0.entrada.autor.id', $this->trabajador->id)
            ->assertJsonPath('resultados.0.entrada.editado_por.id', $this->mayordomo->id);
    }

    public function test_rechaza_entradas_en_obras_no_asignadas(): void
    {
        $otra = Obra::factory()->create();

        $this->sincronizar($this->trabajador, [$this->cambio(['obra_id' => $otra->id])])
            ->assertJsonPath('resultados.0.estado', 'rechazado');

        $this->assertSame(0, Bitacora::count());
    }

    public function test_valida_los_datos(): void
    {
        $this->sincronizar($this->trabajador, [$this->cambio(['categoria' => 'chisme', 'titulo' => ''])])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['cambios.0.categoria', 'cambios.0.titulo']);
    }

    public function test_borrar_deja_una_lapida_que_se_descarga(): void
    {
        $b = Bitacora::factory()->for($this->obra)->create(['user_id' => $this->trabajador->id, 'editado_por' => $this->trabajador->id]);

        $this->sincronizar($this->trabajador, [$this->cambio(['uuid' => $b->uuid, 'titulo' => $b->titulo, 'eliminado' => true])])
            ->assertJsonPath('resultados.0.estado', 'aplicado')
            ->assertJsonPath('resultados.0.entrada.eliminado', true);

        $this->assertNotNull($b->fresh()->eliminado_en);
        $this->actingAs($this->companero)->getJson('/api/bitacora')
            ->assertJsonPath('data.0.uuid', $b->uuid)
            ->assertJsonPath('data.0.eliminado', true);
    }

    public function test_descarga_solo_de_mis_obras_y_desde_el_cursor(): void
    {
        $vieja = Bitacora::factory()->for($this->obra)->create();
        $vieja->forceFill(['updated_at' => now()->subDay()])->saveQuietly();
        $nueva = Bitacora::factory()->for($this->obra)->create();
        Bitacora::factory()->create(); // otra obra

        $todo = $this->actingAs($this->trabajador)->getJson('/api/bitacora')->assertOk();
        $this->assertEqualsCanonicalizing([$vieja->uuid, $nueva->uuid], collect($todo->json('data'))->pluck('uuid')->all());
        $this->assertFalse($todo->json('hay_mas'));

        $desde = $this->actingAs($this->trabajador)->getJson('/api/bitacora?desde='.urlencode(now()->subHour()->toIso8601String()));
        $this->assertSame([$nueva->uuid], collect($desde->json('data'))->pluck('uuid')->all());
    }

    public function test_el_admin_descarga_todas(): void
    {
        Bitacora::factory()->count(2)->create();
        $admin = User::factory()->admin()->create();

        $this->actingAs($admin)->getJson('/api/bitacora')->assertJsonCount(2, 'data');
    }
}
