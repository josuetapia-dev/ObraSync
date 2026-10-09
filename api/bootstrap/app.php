<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware) {
        // Sin token en /api: responder 401, no redirigir a una página de login (la API no tiene vistas).
        $middleware->redirectGuestsTo(fn ($request) => $request->is('api/*') ? null : '/');
    })
    ->withExceptions(function (Exceptions $exceptions) {
        // La API siempre responde JSON (p. ej. 401 sin token), nunca redirige a una página de login.
        $exceptions->shouldRenderJsonWhen(fn ($request) => $request->is('api/*') || $request->expectsJson());
    })->create();
