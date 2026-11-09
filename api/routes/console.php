<?php

use App\Enums\Rol;
use App\Models\Obra;
use App\Models\User;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rules\Password;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

/**
 * php artisan usuario:crear — da de alta un usuario real (todavía no hay panel de admin).
 * La contraseña se escribe oculta y se guarda cifrada (el modelo User la hashea).
 */
Artisan::command('usuario:crear', function () {
    $datos = [
        'name' => $this->ask('Nombre completo'),
        'email' => mb_strtolower(trim((string) $this->ask('Correo'))),
        'rol' => $this->choice('Rol', array_map(fn (Rol $r) => $r->value, Rol::cases()), 0),
        'password' => $this->secret('Contraseña (mínimo 8 caracteres)'),
    ];

    $validacion = Validator::make($datos, [
        'name' => ['required', 'string', 'max:255'],
        'email' => ['required', 'email', 'unique:users,email'],
        'password' => ['required', Password::min(8)],
    ]);
    if ($validacion->fails()) {
        foreach ($validacion->errors()->all() as $error) {
            $this->error($error);
        }

        return 1;
    }

    $usuario = User::create($datos + ['activo' => true]);

    // Obras asignadas (el admin ve todas, no necesita asignación).
    $obras = Obra::orderBy('nombre')->pluck('nombre', 'id');
    if ($usuario->rol !== Rol::Admin && $obras->isNotEmpty()) {
        $elegidas = $this->choice('Obras asignadas (separa con comas)', $obras->values()->all(), null, null, true);
        $usuario->obras()->sync($obras->filter(fn ($nombre) => in_array($nombre, $elegidas, true))->keys());
    }

    $this->info("Usuario creado: {$usuario->email} ({$usuario->rol->value}).");

    return 0;
})->purpose('Crea un usuario de ObraSync');
