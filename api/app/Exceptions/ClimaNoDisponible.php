<?php

namespace App\Exceptions;

use RuntimeException;

/** No se pudo obtener el pronóstico (sin key, OpenWeather caído o sin respuesta). */
class ClimaNoDisponible extends RuntimeException {}
