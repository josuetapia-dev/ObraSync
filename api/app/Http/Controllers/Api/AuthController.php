<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\LoginRequest;
use App\Http\Resources\UsuarioResource;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    /**
     * POST /api/login — valida credenciales y entrega un token de Sanctum.
     * La app guarda el token para seguir trabajando sin conexión.
     */
    public function login(LoginRequest $request): JsonResponse
    {
        $usuario = User::where('email', $request->email)->first();

        // Mismo mensaje si no existe o la contraseña es incorrecta (no revela qué correos existen).
        if (! $usuario || ! Hash::check($request->password, $usuario->password)) {
            throw ValidationException::withMessages([
                'email' => 'Correo o contraseña incorrectos.',
            ]);
        }

        if (! $usuario->activo) {
            return response()->json(['message' => 'Tu cuenta está desactivada. Habla con la oficina.'], 403);
        }

        $token = $usuario->createToken($request->dispositivo ?? 'app')->plainTextToken;

        return response()->json([
            'token' => $token,
            'usuario' => new UsuarioResource($usuario),
        ]);
    }

    /** GET /api/me — datos del usuario dueño del token. */
    public function me(Request $request): UsuarioResource
    {
        return new UsuarioResource($request->user());
    }

    /** POST /api/logout — revoca solo el token de este dispositivo. */
    public function logout(Request $request): Response
    {
        $request->user()->currentAccessToken()->delete();

        return response()->noContent();
    }
}
