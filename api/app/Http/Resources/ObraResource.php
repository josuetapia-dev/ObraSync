<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ObraResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'nombre' => $this->nombre,
            'direccion' => $this->direccion,
            'lat' => $this->lat,
            'lng' => $this->lng,
            'radio_m' => $this->radio_m,
            'actualizada' => $this->updated_at?->toIso8601String(),
        ];
    }
}
