<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Venta;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class VentaController extends Controller
{
    /** GET /api/ventas — ventas sincronizadas con sus detalles (para revisar en el navegador). */
    public function index()
    {
        return Venta::with('detalles.producto:id,nombre')->latest('id')->get();
    }

    /**
     * POST /api/ventas — recibe una venta creada offline en la app y la guarda en MySQL.
     *
     * Responde { id } con el id del servidor; la app lo guarda como server_id.
     * Si la venta ya había llegado (mismo dispositivo_id + local_id), no la duplica:
     * devuelve el mismo id (idempotencia), así reenviarla es seguro.
     */
    public function store(Request $request)
    {
        // 422 si los datos no son válidos (Laravel devuelve los errores en JSON).
        $datos = $request->validate([
            'dispositivo_id' => ['required', 'string', 'max:64'],
            'local_id' => ['required', 'integer', 'min:1'],
            'total' => ['required', 'numeric', 'min:0'],
            'fecha' => ['required', 'date'],
            'detalles' => ['required', 'array', 'min:1'],
            'detalles.*.producto_id' => ['required', 'integer', 'exists:productos,id'],
            'detalles.*.cantidad' => ['required', 'integer', 'min:1'],
            'detalles.*.precio' => ['required', 'numeric', 'min:0'],
            'detalles.*.subtotal' => ['required', 'numeric', 'min:0'],
        ]);

        // ¿Ya existe? Entonces es un reenvío: se responde con el id que ya tiene.
        $existente = Venta::where('dispositivo_id', $datos['dispositivo_id'])
            ->where('local_id', $datos['local_id'])
            ->first();

        if ($existente) {
            return response()->json(['id' => $existente->id, 'duplicada' => true], 200);
        }

        // Venta y detalles se guardan juntos: si algo falla, no queda nada a medias.
        $venta = DB::transaction(function () use ($datos) {
            $venta = Venta::create([
                'dispositivo_id' => $datos['dispositivo_id'],
                'local_id' => $datos['local_id'],
                'total' => $datos['total'],
                'fecha' => $datos['fecha'],
            ]);

            $venta->detalles()->createMany($datos['detalles']);

            return $venta;
        });

        return response()->json(['id' => $venta->id, 'duplicada' => false], 201);
    }
}
