<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Obras (sitios de trabajo). lat/lng + radio_m forman la geocerca para checar asistencia.
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('obras', function (Blueprint $table) {
            $table->id();
            $table->string('nombre');
            $table->string('direccion')->nullable();
            $table->decimal('lat', 10, 7);
            $table->decimal('lng', 10, 7);
            $table->unsignedSmallInteger('radio_m')->default(150); // radio permitido en metros
            $table->boolean('activa')->default(true);
            $table->timestamps();
        });

        // Qué usuarios están asignados a qué obra.
        Schema::create('obra_user', function (Blueprint $table) {
            $table->id();
            $table->foreignId('obra_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->timestamps();
            $table->unique(['obra_id', 'user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('obra_user');
        Schema::dropIfExists('obras');
    }
};
