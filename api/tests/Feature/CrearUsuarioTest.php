<?php

namespace Tests\Feature;

use App\Enums\Rol;
use App\Models\Obra;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class CrearUsuarioTest extends TestCase
{
    use RefreshDatabase;

    public function test_crea_un_trabajador_con_obras_y_puede_iniciar_sesion(): void
    {
        $obra = Obra::factory()->create(['nombre' => 'Obra de prueba']);

        $this->artisan('usuario:crear')
            ->expectsQuestion('Nombre completo', 'Ana López')
            ->expectsQuestion('Correo', ' Ana@Ejemplo.com ')
            ->expectsChoice('Rol', 'trabajador', ['trabajador', 'mayordomo', 'admin'])
            ->expectsQuestion('Contraseña (mínimo 8 caracteres)', 'secreta123')
            ->expectsChoice('Obras asignadas (separa con comas)', ['Obra de prueba'], ['Obra de prueba'])
            ->expectsOutput('Usuario creado: ana@ejemplo.com (trabajador).')
            ->assertSuccessful();

        $usuario = User::where('email', 'ana@ejemplo.com')->firstOrFail();
        $this->assertSame(Rol::Trabajador, $usuario->rol);
        $this->assertTrue(Hash::check('secreta123', $usuario->password));
        $this->assertTrue($usuario->obras->contains($obra));

        $this->postJson('/api/login', ['email' => 'ana@ejemplo.com', 'password' => 'secreta123'])->assertOk();
    }

    public function test_rechaza_correo_repetido_y_contrasena_corta(): void
    {
        User::factory()->create(['email' => 'repetido@ejemplo.com']);

        $this->artisan('usuario:crear')
            ->expectsQuestion('Nombre completo', 'Otro')
            ->expectsQuestion('Correo', 'repetido@ejemplo.com')
            ->expectsChoice('Rol', 'trabajador', ['trabajador', 'mayordomo', 'admin'])
            ->expectsQuestion('Contraseña (mínimo 8 caracteres)', '123')
            ->assertFailed();

        $this->assertSame(1, User::where('email', 'repetido@ejemplo.com')->count());
    }
}
