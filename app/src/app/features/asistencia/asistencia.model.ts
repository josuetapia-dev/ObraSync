export type TipoAsistencia = 'entrada' | 'salida';
export type EstadoSync = 'pending' | 'synced' | 'error' | 'rechazado';

/** Registro de entrada/salida guardado en el teléfono. */
export interface Asistencia {
  local_id: string;
  remote_id: number | null;
  user_id: number;
  obra_id: number;
  tipo: TipoAsistencia;
  registrado_en: string;
  lat: number;
  lng: number;
  precision_m: number | null;
  sync_status: EstadoSync;
  intentos: number;
  ultimo_error: string | null;
  dentro_radio: number | null;      // 1 / 0 (SQLite no tiene booleano); null hasta sincronizar
  distancia_m: number | null;
  reloj_sospechoso: number | null;
  precision_baja: number | null;
  updated_at: string;
}

/** Resultado por registro que devuelve POST /api/asistencias/sync. */
export interface ResultadoServidor {
  uuid: string;
  estado: 'creado' | 'duplicado' | 'rechazado';
  id?: number;
  motivo?: string;
  dentro_radio?: boolean;
  distancia_m?: number;
  reloj_sospechoso?: boolean;
  precision_baja?: boolean;
}
