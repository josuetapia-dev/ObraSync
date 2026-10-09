<?php

namespace App\Actions;

use App\Models\Asistencia;
use App\Models\Obra;
use App\Models\User;
use App\Support\Geo;
use Illuminate\Support\Carbon;

/**
 * Registra una entrada/salida enviada por la app.
 *
 * El servidor es la autoridad: calcula la distancia a la obra, si quedó dentro del
 * radio y si el reloj del teléfono parece manipulado. Es idempotente: si el uuid ya
 * existe, devuelve el registro existente sin duplicarlo.
 */
class RegistrarAsistencia
{
    /** Diferencia máxima tolerada entre el reloj del teléfono y el del servidor. */
    public const TOLERANCIA_RELOJ_SEG = 300;

    /** Si el GPS reporta un margen de error mayor, el registro se marca para revisión. */
    public const PRECISION_MAXIMA_M = 100;

    /**
     * @param  array{uuid:string, obra_id:int, tipo:string, registrado_en:string, lat:float, lng:float, precision_m:?float}  $datos
     * @param  int  $desfaseRelojSeg  servidor - teléfono, medido al recibir el lote
     * @return array{asistencia: Asistencia, duplicado: bool}
     */
    public function __invoke(User $usuario, Obra $obra, array $datos, int $desfaseRelojSeg, ?string $dispositivo): array
    {
        $existente = Asistencia::where('uuid', $datos['uuid'])->first();
        if ($existente) {
            return ['asistencia' => $existente, 'duplicado' => true];
        }

        $distancia = (int) round(Geo::distanciaMetros($obra->lat, $obra->lng, $datos['lat'], $datos['lng']));
        $precision = $datos['precision_m'] ?? null;

        // La hora del teléfono se corrige con el desfase medido (si el reloj estaba mal).
        $registradoEn = Carbon::parse($datos['registrado_en'])->utc()->addSeconds($desfaseRelojSeg);

        $asistencia = Asistencia::create([
            'uuid' => $datos['uuid'],
            'user_id' => $usuario->id,
            'obra_id' => $obra->id,
            'tipo' => $datos['tipo'],
            'registrado_en' => $registradoEn,
            'lat' => $datos['lat'],
            'lng' => $datos['lng'],
            'precision_m' => $precision,
            'distancia_m' => $distancia,
            'dentro_radio' => $distancia <= $obra->radio_m,
            'desfase_reloj_seg' => $desfaseRelojSeg,
            'reloj_sospechoso' => abs($desfaseRelojSeg) > self::TOLERANCIA_RELOJ_SEG,
            'precision_baja' => $precision !== null && $precision > self::PRECISION_MAXIMA_M,
            'dispositivo' => $dispositivo,
        ]);

        return ['asistencia' => $asistencia, 'duplicado' => false];
    }
}
