import { Injectable } from '@angular/core';
import { Geolocation } from '@capacitor/geolocation';

export interface Posicion {
  lat: number;
  lng: number;
  precisionM: number;
  fecha: Date;
}

/** Error de GPS con un mensaje listo para mostrar. */
export class ErrorUbicacion extends Error {}

/**
 * GPS del teléfono (Capacitor Geolocation; en el navegador usa la API del navegador).
 * El GPS funciona sin internet: no necesita datos móviles, solo cielo despejado.
 */
@Injectable({ providedIn: 'root' })
export class Ubicacion {

  async obtener(): Promise<Posicion> {
    try {
      const p = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true, // usa el GPS, no solo wifi/antenas
        timeout: 20_000,
        maximumAge: 15_000,       // acepta una lectura de hace unos segundos
      });
      return {
        lat: p.coords.latitude,
        lng: p.coords.longitude,
        precisionM: Math.round(p.coords.accuracy),
        fecha: new Date(p.timestamp),
      };
    } catch (e) {
      throw new ErrorUbicacion(this.describir(e));
    }
  }

  private describir(e: unknown): string {
    // Códigos del navegador: 1 permiso, 2 no disponible, 3 tiempo agotado.
    const codigo = (e as { code?: number | string })?.code;
    const texto = String((e as Error)?.message ?? '').toLowerCase();
    if (codigo === 1 || texto.includes('denied') || texto.includes('permission')) {
      return 'Sin permiso de ubicación. Actívalo en los ajustes del teléfono para poder checar.';
    }
    if (codigo === 3 || texto.includes('timeout')) {
      return 'El GPS tardó demasiado. Sal a un lugar abierto e intenta de nuevo.';
    }
    if (texto.includes('disabled') || texto.includes('not enabled')) {
      return 'La ubicación del teléfono está apagada. Enciéndela e intenta de nuevo.';
    }
    return 'No se pudo obtener tu ubicación. Intenta de nuevo.';
  }
}
