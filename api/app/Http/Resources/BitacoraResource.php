<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class BitacoraResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'uuid' => $this->uuid,
            'obra_id' => $this->obra_id,
            'autor' => ['id' => $this->user_id, 'nombre' => $this->autor->name],
            'editado_por' => ['id' => $this->editado_por, 'nombre' => $this->editor->name],
            'categoria' => $this->categoria->value,
            'titulo' => $this->titulo,
            'descripcion' => $this->descripcion,
            'fecha' => $this->fecha->toDateString(),
            'editado_en' => $this->editado_en->toIso8601String(),
            'eliminado' => $this->eliminado_en !== null,
        ];
    }
}
