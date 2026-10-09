<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Registros de entrada/salida. Son de solo agregar: nunca se editan ni se borran
 * (las correcciones serán "ajustes" aprobados por el admin, en otra tabla).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('asistencias', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();                 // generado en el teléfono: evita duplicados al reenviar
            $table->foreignId('user_id')->constrained();
            $table->foreignId('obra_id')->constrained();
            $table->string('tipo', 10);                     // entrada | salida
            $table->dateTime('registrado_en');              // hora del teléfono al checar (UTC)
            $table->decimal('lat', 10, 7);
            $table->decimal('lng', 10, 7);
            $table->float('precision_m')->nullable();       // margen de error del GPS en metros

            // Calculado por el servidor (el teléfono no lo decide):
            $table->unsignedInteger('distancia_m');         // distancia al centro de la obra
            $table->boolean('dentro_radio');
            $table->integer('desfase_reloj_seg');           // reloj del teléfono vs. servidor
            $table->boolean('reloj_sospechoso')->default(false);
            $table->boolean('precision_baja')->default(false);

            $table->string('dispositivo', 100)->nullable();
            $table->timestamps();                           // created_at = cuándo llegó al servidor

            $table->index(['obra_id', 'registrado_en']);
            $table->index(['user_id', 'registrado_en']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('asistencias');
    }
};
