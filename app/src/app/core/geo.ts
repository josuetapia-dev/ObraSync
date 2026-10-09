const RADIO_TIERRA_M = 6_371_000;

/**
 * Distancia en metros entre dos puntos (fórmula de Haversine).
 * Es la misma que usa Laravel (App\Support\Geo). En la app solo sirve como vista previa:
 * la distancia que cuenta es la que calcula el servidor.
 */
export function distanciaMetros(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const rad = (g: number) => (g * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * RADIO_TIERRA_M * Math.asin(Math.sqrt(a));
}

/** "35 m" o "1.2 km". */
export function formatearDistancia(m: number): string {
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;
}
