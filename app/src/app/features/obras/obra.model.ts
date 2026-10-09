/** Obra asignada (copia local de la que entrega Laravel). */
export interface Obra {
  id: number;
  nombre: string;
  direccion: string | null;
  lat: number;
  lng: number;
  radio_m: number;
  actualizada: string | null;
}

export type Nivel = 'verde' | 'amarillo' | 'rojo';

export interface Riesgo {
  nivel: Nivel;
  valor: number;
  unidad: string;
  mensaje: string;
}

/** Condiciones de obra calculadas por Laravel a partir del pronóstico. */
export interface Condiciones {
  actualizado: string;
  ahora: { temp: number; sensacion: number; humedad: number; descripcion: string; codigo: number };
  nivel: Nivel;
  riesgos: { calor: Riesgo; lluvia: Riesgo; viento: Riesgo };
  proximas_horas: { hora: string; temp: number; prob_lluvia: number; rafaga_kmh: number; codigo: number }[];
}

/** Condiciones guardadas en el dispositivo + cuándo se descargaron. */
export interface CondicionesGuardadas {
  datos: Condiciones;
  guardadoEn: Date;
}
