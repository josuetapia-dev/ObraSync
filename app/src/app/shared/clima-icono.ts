/** Icono de Ionicons según el código de condición de OpenWeather. */
export function iconoClima(codigo: number): string {
  if (codigo >= 200 && codigo < 300) return 'thunderstorm-outline';
  if (codigo >= 300 && codigo < 600) return 'rainy-outline';
  if (codigo >= 600 && codigo < 700) return 'snow-outline';
  if (codigo >= 700 && codigo < 800) return 'cloudy-outline';
  if (codigo === 800) return 'sunny-outline';
  if (codigo <= 802) return 'partly-sunny-outline';
  return 'cloudy-outline';
}
