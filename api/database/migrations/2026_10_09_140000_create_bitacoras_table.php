<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Bitácora de obra: notas compartidas por la cuadrilla (avances, incidencias, material...).
 * A diferencia de la asistencia, sí se editan. Si dos personas editan la misma entrada,
 * gana la edición más reciente (editado_en). Borrar solo marca eliminado_en, para que
 * el borrado también llegue a los demás teléfonos.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('bitacoras', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();                     // generado en el teléfono
            $table->foreignId('obra_id')->constrained();
            $table->foreignId('user_id')->constrained();        // autor
            $table->foreignId('editado_por')->constrained('users');
            $table->string('categoria', 20);
            $table->string('titulo', 120);
            $table->text('descripcion')->nullable();
            $table->date('fecha');                              // día al que se refiere la nota
            $table->dateTime('editado_en');                     // última edición (corregida con el reloj del servidor)
            $table->dateTime('eliminado_en')->nullable();       // "lápida": borrado que también se sincroniza
            $table->timestamps();                               // updated_at = cursor para descargar cambios

            $table->index(['obra_id', 'fecha']);
            $table->index('updated_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('bitacoras');
    }
};
