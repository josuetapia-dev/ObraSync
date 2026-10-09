<?php

namespace App\Http\Controllers\Api;

use App\Enums\Rol;
use App\Http\Controllers\Controller;
use App\Http\Resources\ObraResource;
use App\Models\Obra;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class ObraController extends Controller
{
    /**
     * GET /api/obras — obras activas del usuario (el admin ve todas).
     * La app las guarda en SQLite para usarlas sin conexión.
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $usuario = $request->user();

        $obras = $usuario->tieneRol(Rol::Admin)
            ? Obra::activas()->orderBy('nombre')->get()
            : $usuario->obras()->activas()->orderBy('nombre')->get();

        return ObraResource::collection($obras);
    }

    /** GET /api/obras/{obra} — detalle (solo si puede verla). */
    public function show(Obra $obra): ObraResource
    {
        $this->authorize('view', $obra);

        return new ObraResource($obra);
    }
}
