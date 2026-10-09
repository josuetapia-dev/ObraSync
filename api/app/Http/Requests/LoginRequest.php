<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class LoginRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
            // Nombre del dispositivo (p. ej. "Chrome en Windows"); ayuda a identificar sesiones.
            'dispositivo' => ['nullable', 'string', 'max:100'],
        ];
    }
}
