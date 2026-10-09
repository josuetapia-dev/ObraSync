<?php

namespace App\Http\Controllers\Api;

use App\Exceptions\ClimaNoDisponible;
use App\Http\Controllers\Controller;
use App\Models\Obra;
use App\Services\CondicionesObra;
use Illuminate\Http\JsonResponse;

class CondicionesController extends Controller
{
    /** GET /api/obras/{obra}/condiciones — semáforo de calor, lluvia y viento de la obra. */
    public function __invoke(Obra $obra, CondicionesObra $condiciones): JsonResponse
    {
        $this->authorize('view', $obra);

        try {
            return response()->json(['data' => $condiciones->paraObra($obra)]);
        } catch (ClimaNoDisponible $e) {
            report($e);

            // 503: la app sigue mostrando las últimas condiciones guardadas (cache-first).
            return response()->json(['message' => 'El clima no está disponible por ahora.'], 503);
        }
    }
}
