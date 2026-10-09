/** Resultado de enviar una cola. */
export interface ResultadoCola {
  enviados: number;    // aceptados por el servidor (creados o duplicados)
  rechazados: number;  // el servidor no los acepta (no se reintentan)
  errores: number;     // fallaron por red/servidor (se reintentan)
}

/**
 * Contrato que implementa cada módulo con datos por sincronizar
 * (asistencia, bitácora, reportes...). El Sincronizador no sabe de qué módulo se trata.
 */
export interface ColaSync {
  readonly nombre: string;
  contarPendientes(userId: number): Promise<number>;
  enviarPendientes(userId: number): Promise<ResultadoCola>;
}
