<?php

namespace App\Http\Requests;

use App\Enums\CategoriaBitacora;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class SincronizarBitacoraRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // los permisos se revisan entrada por entrada
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'enviado_en' => ['required', 'date'],
            'cambios' => ['required', 'array', 'min:1', 'max:200'],
            'cambios.*.uuid' => ['required', 'uuid'],
            'cambios.*.obra_id' => ['required', 'integer'],
            'cambios.*.categoria' => ['required', Rule::enum(CategoriaBitacora::class)],
            'cambios.*.titulo' => ['required', 'string', 'max:120'],
            'cambios.*.descripcion' => ['nullable', 'string', 'max:2000'],
            'cambios.*.fecha' => ['required', 'date_format:Y-m-d'],
            'cambios.*.editado_en' => ['required', 'date'],
            'cambios.*.eliminado' => ['required', 'boolean'],
        ];
    }
}
