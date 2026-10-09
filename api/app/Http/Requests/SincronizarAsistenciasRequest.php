<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class SincronizarAsistenciasRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // el permiso por obra se revisa registro por registro
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'enviado_en' => ['required', 'date'],          // hora del teléfono al enviar el lote
            'dispositivo' => ['nullable', 'string', 'max:100'],
            'registros' => ['required', 'array', 'min:1', 'max:200'],
            'registros.*.uuid' => ['required', 'uuid'],
            'registros.*.obra_id' => ['required', 'integer'],
            'registros.*.tipo' => ['required', Rule::in(['entrada', 'salida'])],
            'registros.*.registrado_en' => ['required', 'date'],
            'registros.*.lat' => ['required', 'numeric', 'between:-90,90'],
            'registros.*.lng' => ['required', 'numeric', 'between:-180,180'],
            'registros.*.precision_m' => ['nullable', 'numeric', 'min:0'],
        ];
    }
}
