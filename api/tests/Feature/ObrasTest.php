<?php

namespace Tests\Feature;

use App\Models\Obra;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ObrasTest extends TestCase
{
    use RefreshDatabase;

    public function test_requiere_sesion(): void
    {
        $this->getJson('/api/obras')->assertUnauthorized();
    }

    public function test_trabajador_ve_solo_sus_obras_activas(): void
    {
        $trabajador = User::factory()->create();
        $suya = Obra::factory()->create(['nombre' => 'A suya']);
        $ajena = Obra::factory()->create(['nombre' => 'B ajena']);
        $cerrada = Obra::factory()->inactiva()->create(['nombre' => 'C cerrada']);
        $trabajador->obras()->attach([$suya->id, $cerrada->id]);

        $res = $this->actingAs($trabajador)->getJson('/api/obras')->assertOk();

        $this->assertSame(['A suya'], collect($res->json('data'))->pluck('nombre')->all());
        $res->assertJsonStructure(['data' => [['id', 'nombre', 'direccion', 'lat', 'lng', 'radio_m', 'actualizada']]]);
    }

    public function test_admin_ve_todas_las_obras_activas(): void
    {
        Obra::factory()->count(3)->create();
        Obra::factory()->inactiva()->create();

        $this->actingAs(User::factory()->admin()->create())
            ->getJson('/api/obras')
            ->assertOk()
            ->assertJsonCount(3, 'data');
    }

    public function test_no_puede_ver_una_obra_no_asignada(): void
    {
        $trabajador = User::factory()->create();
        $ajena = Obra::factory()->create();

        $this->actingAs($trabajador)->getJson("/api/obras/{$ajena->id}")->assertForbidden();
    }

    public function test_ve_el_detalle_de_su_obra(): void
    {
        $mayordomo = User::factory()->mayordomo()->create();
        $obra = Obra::factory()->create(['lat' => 19.9312, 'lng' => -96.8504, 'radio_m' => 200]);
        $mayordomo->obras()->attach($obra);

        $this->actingAs($mayordomo)->getJson("/api/obras/{$obra->id}")
            ->assertOk()
            ->assertJsonPath('data.lat', 19.9312)
            ->assertJsonPath('data.radio_m', 200);
    }
}
