<?php

namespace App\Services;

use App\Exceptions\ClimaNoDisponible;
use App\Models\Obra;
use App\Support\IndiceCalor;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

/**
 * Convierte el pronóstico de OpenWeather en decisiones de obra (semáforo):
 * - Calor  → descansos e hidratación (prevención de golpe de calor, base Cal/OSHA).
 * - Lluvia → si conviene colar concreto.
 * - Viento → si se pueden hacer izajes con grúa.
 *
 * El resultado se guarda en caché 30 min por obra: muchos trabajadores = 1 llamada a OpenWeather.
 */
class CondicionesObra
{
    public const MINUTOS_CACHE = 30;

    /** Horizonte para decidir (próximas 6 h = 2 bloques de 3 h del pronóstico). */
    private const BLOQUES_DECISION = 2;

    public function paraObra(Obra $obra): array
    {
        return Cache::remember(
            "condiciones:obra:{$obra->id}",
            now()->addMinutes(self::MINUTOS_CACHE),
            fn () => $this->evaluar($this->pronostico($obra->lat, $obra->lng))
        );
    }

    /**
     * Aplica las reglas del semáforo a la lista del pronóstico (formato /data/2.5/forecast).
     * Es pública para poder probar las reglas sin llamar a la red.
     */
    public function evaluar(array $lista): array
    {
        $ahora = $lista[0];
        $proximas = array_slice($lista, 0, self::BLOQUES_DECISION);

        $indiceCalor = max(array_map(
            fn ($b) => IndiceCalor::calcular($b['main']['temp'], $b['main']['humidity']),
            $proximas
        ));
        $probLluvia = (int) round(max(array_map(fn ($b) => $b['pop'] ?? 0, $proximas)) * 100);
        $rafagaKmh = (int) round(max(array_map(fn ($b) => $this->rafagaKmh($b), $proximas)));

        $riesgos = [
            'calor' => $this->riesgoCalor($indiceCalor),
            'lluvia' => $this->riesgoLluvia($probLluvia),
            'viento' => $this->riesgoViento($rafagaKmh),
        ];

        return [
            'actualizado' => now()->toIso8601String(),
            'ahora' => [
                'temp' => round($ahora['main']['temp'], 1),
                'sensacion' => round($ahora['main']['feels_like'], 1),
                'humedad' => $ahora['main']['humidity'],
                'descripcion' => $ahora['weather'][0]['description'] ?? '',
                'codigo' => $ahora['weather'][0]['id'] ?? 800,
            ],
            'nivel' => $this->peor(array_column($riesgos, 'nivel')),
            'riesgos' => $riesgos,
            'proximas_horas' => array_map(fn ($b) => [
                'hora' => Carbon::createFromTimestampUTC($b['dt'])->toIso8601String(),
                'temp' => round($b['main']['temp'], 1),
                'prob_lluvia' => (int) round(($b['pop'] ?? 0) * 100),
                'rafaga_kmh' => (int) round($this->rafagaKmh($b)),
                'codigo' => $b['weather'][0]['id'] ?? 800,
            ], array_slice($lista, 0, 8)),
        ];
    }

    // ---------------------------------------------------------------- reglas

    private function riesgoCalor(float $indice): array
    {
        return match (true) {
            $indice > 32 => $this->riesgo('rojo', $indice, '°C', 'Calor extremo: descanso a la sombra cada 2 h, agua constante y vigilancia entre compañeros.'),
            $indice >= 27 => $this->riesgo('amarillo', $indice, '°C', 'Calor: hidratación cada hora y pausas a la sombra.'),
            default => $this->riesgo('verde', $indice, '°C', 'Temperatura sin riesgo.'),
        };
    }

    private function riesgoLluvia(int $probabilidad): array
    {
        return match (true) {
            $probabilidad >= 60 => $this->riesgo('rojo', $probabilidad, '%', 'Lluvia probable: reprograma los colados de concreto.'),
            $probabilidad >= 30 => $this->riesgo('amarillo', $probabilidad, '%', 'Posible lluvia: ten lonas listas antes de colar.'),
            default => $this->riesgo('verde', $probabilidad, '%', 'Sin lluvia prevista.'),
        };
    }

    private function riesgoViento(int $rafagaKmh): array
    {
        return match (true) {
            $rafagaKmh > 32 => $this->riesgo('rojo', $rafagaKmh, 'km/h', 'Ráfagas fuertes: suspende izajes con grúa.'),
            $rafagaKmh > 20 => $this->riesgo('amarillo', $rafagaKmh, 'km/h', 'Ráfagas moderadas: precaución en alturas y con cargas.'),
            default => $this->riesgo('verde', $rafagaKmh, 'km/h', 'Viento en calma.'),
        };
    }

    private function riesgo(string $nivel, float|int $valor, string $unidad, string $mensaje): array
    {
        return compact('nivel', 'valor', 'unidad', 'mensaje');
    }

    private function peor(array $niveles): string
    {
        foreach (['rojo', 'amarillo'] as $n) {
            if (in_array($n, $niveles, true)) {
                return $n;
            }
        }

        return 'verde';
    }

    /** Ráfaga en km/h (si no viene ráfaga, se usa la velocidad media). */
    private function rafagaKmh(array $bloque): float
    {
        return ($bloque['wind']['gust'] ?? $bloque['wind']['speed'] ?? 0) * 3.6;
    }

    // ---------------------------------------------------------------- OpenWeather

    private function pronostico(float $lat, float $lng): array
    {
        $key = config('services.openweather.key');
        if (! $key) {
            throw new ClimaNoDisponible('Falta configurar OPENWEATHER_KEY en el servidor.');
        }

        try {
            $lista = Http::timeout(8)
                ->retry(2, 300, throw: false)
                ->get(config('services.openweather.url').'/forecast', [
                    'lat' => $lat,
                    'lon' => $lng,
                    'units' => 'metric',
                    'lang' => 'es',
                    'cnt' => 8, // 8 bloques de 3 h = próximas 24 h
                    'appid' => $key,
                ])
                ->throw()
                ->json('list');
        } catch (ConnectionException|RequestException $e) {
            throw new ClimaNoDisponible('El servicio del clima no respondió.', previous: $e);
        }

        if (empty($lista[0]['main'])) {
            throw new ClimaNoDisponible('El servicio del clima respondió con datos incompletos.');
        }

        return $lista;
    }
}
