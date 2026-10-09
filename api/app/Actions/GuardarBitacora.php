<?php

namespace App\Actions;

use App\Models\Bitacora;
use App\Models\Obra;
use App\Models\User;
use Illuminate\Support\Carbon;

/**
 * Aplica un cambio de la bitácora hecho en el teléfono (crear, editar o borrar).
 *
 * Conflictos: "gana la última edición". Si el servidor ya tiene una versión más
 * reciente, el cambio se descarta y se devuelve la versión del servidor para que
 * el teléfono la adopte. La hora del teléfono se corrige con el desfase de su reloj,
 * así un reloj adelantado no gana siempre.
 */
class GuardarBitacora
{
    /**
     * @param  array{uuid:string, obra_id:int, categoria:string, titulo:string, descripcion:?string, fecha:string, editado_en:string, eliminado:bool}  $datos
     * @return array{estado: 'aplicado'|'conflicto'|'rechazado', bitacora?: Bitacora, motivo?: string}
     */
    public function __invoke(User $usuario, array $datos, int $desfaseRelojSeg): array
    {
        $editadoEn = Carbon::parse($datos['editado_en'])->utc()->addSeconds($desfaseRelojSeg);
        if ($editadoEn->isFuture()) {
            $editadoEn = now();
        }

        $campos = [
            'categoria' => $datos['categoria'],
            'titulo' => $datos['titulo'],
            'descripcion' => $datos['descripcion'] ?? null,
            'fecha' => $datos['fecha'],
            'editado_por' => $usuario->id,
            'editado_en' => $editadoEn,
            'eliminado_en' => ! empty($datos['eliminado']) ? $editadoEn : null,
        ];

        $existente = Bitacora::with('obra')->where('uuid', $datos['uuid'])->first();

        if (! $existente) {
            $obra = Obra::find($datos['obra_id']);
            if (! $obra || $usuario->cannot('view', $obra)) {
                return ['estado' => 'rechazado', 'motivo' => 'No estás asignado a esta obra.'];
            }

            $nueva = Bitacora::create($campos + [
                'uuid' => $datos['uuid'],
                'obra_id' => $obra->id,
                'user_id' => $usuario->id,
            ]);

            return ['estado' => 'aplicado', 'bitacora' => $nueva];
        }

        if ($usuario->cannot('update', $existente)) {
            return ['estado' => 'rechazado', 'motivo' => 'Solo el autor o el mayordomo pueden editar esta entrada.'];
        }

        // Reenvío del mismo cambio (p. ej. se perdió la respuesta): no es un conflicto.
        if ($this->mismoContenido($existente, $campos)) {
            return ['estado' => 'aplicado', 'bitacora' => $existente];
        }

        // El servidor tiene una edición más reciente: gana la del servidor.
        if ($existente->editado_en->gte($editadoEn)) {
            return ['estado' => 'conflicto', 'bitacora' => $existente];
        }

        $existente->update($campos);

        return ['estado' => 'aplicado', 'bitacora' => $existente];
    }

    private function mismoContenido(Bitacora $b, array $campos): bool
    {
        return $b->categoria->value === $campos['categoria']
            && $b->titulo === $campos['titulo']
            && $b->descripcion === $campos['descripcion']
            && $b->fecha->toDateString() === $campos['fecha']
            && ($b->eliminado_en === null) === ($campos['eliminado_en'] === null);
    }
}
