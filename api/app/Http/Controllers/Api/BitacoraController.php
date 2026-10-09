<?php

namespace App\Http\Controllers\Api;

use App\Actions\GuardarBitacora;
use App\Enums\Rol;
use App\Http\Controllers\Controller;
use App\Http\Requests\SincronizarBitacoraRequest;
use App\Http\Resources\BitacoraResource;
use App\Models\Bitacora;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class BitacoraController extends Controller
{
    /** Máximo de entradas por descarga; si hay más, la app pide la siguiente página. */
    private const LIMITE = 200;

    /**
     * GET /api/bitacora?desde= — entradas de mis obras que cambiaron desde el cursor
     * (incluye las borradas, para que el teléfono también las quite).
     */
    public function index(Request $request): JsonResponse
    {
        $request->validate(['desde' => ['nullable', 'date']]);

        $usuario = $request->user();
        $ahora = now();

        $consulta = Bitacora::query()->with(['autor', 'editor'])->orderBy('updated_at')->orderBy('id');

        if (! $usuario->tieneRol(Rol::Admin)) {
            $consulta->whereIn('obra_id', $usuario->obras()->select('obras.id'));
        }
        if ($request->filled('desde')) {
            // >= : lo que cambió en el mismo segundo del cursor se repite, pero no se pierde.
            $consulta->where('updated_at', '>=', Carbon::parse($request->desde)->utc());
        }

        $entradas = $consulta->limit(self::LIMITE + 1)->get();
        $hayMas = $entradas->count() > self::LIMITE;
        $entradas = $entradas->take(self::LIMITE);

        return response()->json([
            'data' => BitacoraResource::collection($entradas),
            // Siguiente cursor: la última enviada (si hay más páginas) o la hora del servidor.
            'cursor' => ($hayMas ? $entradas->last()->updated_at : $ahora)->toIso8601String(),
            'hay_mas' => $hayMas,
        ]);
    }

    /**
     * POST /api/bitacora/sync — cambios hechos en el teléfono (crear, editar, borrar).
     * Responde por cada cambio: aplicado, conflicto (con la versión ganadora) o rechazado.
     */
    public function sincronizar(SincronizarBitacoraRequest $request, GuardarBitacora $guardar): JsonResponse
    {
        $usuario = $request->user();
        $desfase = (int) round(now()->floatDiffInSeconds(Carbon::parse($request->enviado_en), false) * -1);

        $resultados = collect($request->cambios)->map(function (array $cambio) use ($usuario, $guardar, $desfase) {
            $r = $guardar($usuario, $cambio, $desfase);

            return array_filter([
                'uuid' => $cambio['uuid'],
                'estado' => $r['estado'],
                'motivo' => $r['motivo'] ?? null,
                'entrada' => isset($r['bitacora']) ? new BitacoraResource($r['bitacora']->load(['autor', 'editor'])) : null,
            ], fn ($v) => $v !== null);
        });

        return response()->json(['resultados' => $resultados]);
    }
}
