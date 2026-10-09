<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Ventas recibidas desde la app (cada una nació primero en SQLite del dispositivo).
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ventas', function (Blueprint $table) {
            $table->id();                                  // id del servidor (server_id en la app)
            $table->string('dispositivo_id', 64);          // identifica el navegador/teléfono que la creó
            $table->unsignedBigInteger('local_id');        // id que tenía la venta en SQLite
            $table->decimal('total', 10, 2);
            $table->dateTime('fecha');                     // fecha en que se hizo la venta (offline)
            $table->timestamps();                          // created_at = cuándo llegó al servidor

            // Idempotencia: la misma venta del mismo dispositivo no puede guardarse dos veces,
            // aunque la app la reenvíe (p. ej. si se cortó la red antes de recibir la respuesta).
            $table->unique(['dispositivo_id', 'local_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ventas');
    }
};
