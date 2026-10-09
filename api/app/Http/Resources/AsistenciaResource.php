<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class AsistenciaResource extends JsonResource
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
            'usuario' => $this->whenLoaded('usuario', fn () => ['id' => $this->usuario->id, 'nombre' => $this->usuario->name]),
            'tipo' => $this->tipo->value,
            'registrado_en' => $this->registrado_en->toIso8601String(),
            'lat' => $this->lat,
            'lng' => $this->lng,
            'precision_m' => $this->precision_m,
            'distancia_m' => $this->distancia_m,
            'dentro_radio' => $this->dentro_radio,
            'reloj_sospechoso' => $this->reloj_sospechoso,
            'precision_baja' => $this->precision_baja,
            'recibido_en' => $this->created_at->toIso8601String(),
        ];
    }
}
