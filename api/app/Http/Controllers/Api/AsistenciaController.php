<?php

namespace App\Http\Controllers\Api;

use App\Actions\RegistrarAsistencia;
use App\Enums\Rol;
use App\Http\Controllers\Controller;
use App\Http\Requests\SincronizarAsistenciasRequest;
use App\Http\Resources\AsistenciaResource;
use App\Models\Asistencia;
use App\Models\Obra;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Carbon;

class AsistenciaController extends Controller
{
    /**
     * POST /api/asistencias/sync — recibe un lote de registros hechos (quizá sin señal) en la app.
     * Responde el resultado de CADA registro, para que la app sepa cuáles marcar como sincronizados.
     */
    public function sincronizar(SincronizarAsistenciasRequest $request, RegistrarAsistencia $registrar): JsonResponse
    {
        $usuario = $request->user();

        // Desfase del reloj: hora del servidor menos la hora que el teléfono dice tener ahora.
        $desfase = (int) round(now()->floatDiffInSeconds(Carbon::parse($request->enviado_en), false) * -1);

        $obras = Obra::whereIn('id', collect($request->registros)->pluck('obra_id')->unique())->get()->keyBy('id');
        $resultados = [];

        foreach ($request->registros as $datos) {
            $obra = $obras->get($datos['obra_id']);

            // Sin permiso sobre la obra: se rechaza ese registro (no se reintentará).
            if (! $obra || $usuario->cannot('view', $obra)) {
                $resultados[] = ['uuid' => $datos['uuid'], 'estado' => 'rechazado', 'motivo' => 'No estás asignado a esta obra.'];

                continue;
            }

            ['asistencia' => $a, 'duplicado' => $dup] = $registrar($usuario, $obra, $datos, $desfase, $request->dispositivo);

            $resultados[] = [
                'uuid' => $a->uuid,
                'estado' => $dup ? 'duplicado' : 'creado',
                'id' => $a->id,
                'dentro_radio' => $a->dentro_radio,
                'distancia_m' => $a->distancia_m,
                'reloj_sospechoso' => $a->reloj_sospechoso,
                'precision_baja' => $a->precision_baja,
            ];
        }

        return response()->json(['resultados' => $resultados, 'desfase_reloj_seg' => $desfase]);
    }

    /**
     * GET /api/asistencias — historial.
     * Trabajador: solo los suyos. Mayordomo/admin con ?obra_id=: los de la cuadrilla de esa obra.
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $request->validate([
            'obra_id' => ['nullable', 'integer', 'exists:obras,id'],
            'desde' => ['nullable', 'date'],
        ]);

        $usuario = $request->user();
        $consulta = Asistencia::query()->with('usuario')->latest('registrado_en');

        if ($request->filled('obra_id')) {
            $obra = Obra::findOrFail($request->obra_id);
            $this->authorize('view', $obra);
            $consulta->where('obra_id', $obra->id);

            if (! $usuario->tieneRol(Rol::Mayordomo, Rol::Admin)) {
                $consulta->where('user_id', $usuario->id);
            }
        } else {
            $consulta->where('user_id', $usuario->id);
        }

        $consulta->where('registrado_en', '>=', Carbon::parse($request->input('desde', now()->subDays(30))));

        return AsistenciaResource::collection($consulta->limit(500)->get());
    }
}
