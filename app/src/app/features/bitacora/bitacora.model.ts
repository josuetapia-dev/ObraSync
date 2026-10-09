export type Categoria = 'avance' | 'incidencia' | 'material' | 'seguridad';
export type EstadoSyncBitacora = 'synced' | 'pending' | 'error' | 'rechazado';

/** Categorías con su texto e icono (el color nunca va solo). */
export const CATEGORIAS: { valor: Categoria; etiqueta: string; icono: string }[] = [
  { valor: 'avance', etiqueta: 'Avance', icono: 'trending-up-outline' },
  { valor: 'incidencia', etiqueta: 'Incidencia', icono: 'alert-circle-outline' },
  { valor: 'material', etiqueta: 'Material', icono: 'cube-outline' },
  { valor: 'seguridad', etiqueta: 'Seguridad', icono: 'shield-checkmark-outline' },
];

export const CATEGORIA = Object.fromEntries(CATEGORIAS.map(c => [c.valor, c])) as Record<Categoria, (typeof CATEGORIAS)[number]>;

/** Nota de bitácora guardada en el teléfono. */
export interface EntradaBitacora {
  local_id: string;
  remote_id: number | null;
  obra_id: number;
  autor_id: number;
  autor_nombre: string | null;
  editado_por_id: number | null;
  editado_por_nombre: string | null;
  categoria: Categoria;
  titulo: string;
  descripcion: string | null;
  fecha: string;
  editado_en: string;
  eliminado: number;
  sync_status: EstadoSyncBitacora;
  pendiente_de: number | null;
  intentos: number;
  ultimo_error: string | null;
  conflicto: number;
}

/** Lo que el usuario escribe en el formulario. */
export interface DatosBitacora {
  obraId: number;
  categoria: Categoria;
  titulo: string;
  descripcion: string | null;
  fecha: string;
}

/** Filtros de la lista (todos se aplican en SQLite). */
export interface FiltroBitacora {
  texto?: string;
  categoria?: Categoria | null;
  obraId?: number | null;
  soloPendientes?: boolean;
}

/** Misma regla que BitacoraPolicy en Laravel: el autor, o el mayordomo/admin. */
export function puedeEditar(e: EntradaBitacora, usuario: { id: number; rol: string } | null): boolean {
  return !!usuario && (e.autor_id === usuario.id || usuario.rol === 'mayordomo' || usuario.rol === 'admin');
}

/** Entrada tal como la entrega Laravel (BitacoraResource). */
export interface EntradaServidor {
  id: number;
  uuid: string;
  obra_id: number;
  autor: { id: number; nombre: string };
  editado_por: { id: number; nombre: string };
  categoria: Categoria;
  titulo: string;
  descripcion: string | null;
  fecha: string;
  editado_en: string;
  eliminado: boolean;
}

/** Resultado por cambio de POST /api/bitacora/sync. */
export interface ResultadoBitacora {
  uuid: string;
  estado: 'aplicado' | 'conflicto' | 'rechazado';
  motivo?: string;
  entrada?: EntradaServidor;
}
