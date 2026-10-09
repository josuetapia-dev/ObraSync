<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuthTest extends TestCase
{
    use RefreshDatabase;

    public function test_login_correcto_devuelve_token_y_usuario_con_rol(): void
    {
        $usuario = User::factory()->mayordomo()->create(['email' => 'carlos@obrasync.test']);

        $res = $this->postJson('/api/login', [
            'email' => 'carlos@obrasync.test',
            'password' => 'password',
            'dispositivo' => 'Prueba',
        ]);

        $res->assertOk()
            ->assertJsonStructure(['token', 'usuario' => ['id', 'nombre', 'email', 'rol', 'rol_etiqueta']])
            ->assertJsonPath('usuario.rol', 'mayordomo')
            ->assertJsonMissingPath('usuario.password');

        $this->assertDatabaseHas('personal_access_tokens', ['tokenable_id' => $usuario->id, 'name' => 'Prueba']);
    }

    public function test_contrasena_incorrecta_responde_422_sin_revelar_si_existe(): void
    {
        User::factory()->create(['email' => 'juan@obrasync.test']);

        $this->postJson('/api/login', ['email' => 'juan@obrasync.test', 'password' => 'mal'])
            ->assertStatus(422)
            ->assertJsonPath('errors.email.0', 'Correo o contraseña incorrectos.');

        $this->postJson('/api/login', ['email' => 'noexiste@obrasync.test', 'password' => 'mal'])
            ->assertStatus(422)
            ->assertJsonPath('errors.email.0', 'Correo o contraseña incorrectos.');
    }

    public function test_usuario_inactivo_no_puede_entrar(): void
    {
        User::factory()->inactivo()->create(['email' => 'baja@obrasync.test']);

        $this->postJson('/api/login', ['email' => 'baja@obrasync.test', 'password' => 'password'])
            ->assertForbidden();
    }

    public function test_me_requiere_token_y_responde_json_401(): void
    {
        $this->getJson('/api/me')->assertUnauthorized();
        $this->get('/api/me')->assertUnauthorized(); // aunque no pida JSON, no redirige
    }

    public function test_me_con_token_devuelve_el_usuario(): void
    {
        $usuario = User::factory()->admin()->create();
        $token = $usuario->createToken('app')->plainTextToken;

        $this->withToken($token)->getJson('/api/me')
            ->assertOk()
            ->assertJsonPath('data.email', $usuario->email)
            ->assertJsonPath('data.rol', 'admin');
    }

    public function test_logout_revoca_solo_el_token_actual(): void
    {
        $usuario = User::factory()->create();
        $tokenA = $usuario->createToken('telefono')->plainTextToken;
        $tokenB = $usuario->createToken('tablet')->plainTextToken;

        $this->withToken($tokenA)->postJson('/api/logout')->assertNoContent();

        $this->app['auth']->forgetGuards(); // limpia el usuario cacheado entre peticiones de la prueba
        $this->withToken($tokenA)->getJson('/api/me')->assertUnauthorized();

        $this->app['auth']->forgetGuards();
        $this->withToken($tokenB)->getJson('/api/me')->assertOk();
    }

    public function test_login_limita_intentos_por_minuto(): void
    {
        User::factory()->create(['email' => 'ataque@obrasync.test']);

        foreach (range(1, 5) as $_) {
            $this->postJson('/api/login', ['email' => 'ataque@obrasync.test', 'password' => 'mal'])->assertStatus(422);
        }

        $this->postJson('/api/login', ['email' => 'ataque@obrasync.test', 'password' => 'mal'])
            ->assertStatus(429);
    }
}
