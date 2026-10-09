import { Injectable, signal } from '@angular/core';

/** Estado de la conexión a internet, compartido por toda la app (patrón observer con signals). */
@Injectable({ providedIn: 'root' })
export class Red {

  readonly enLinea = signal(navigator.onLine);

  constructor() {
    window.addEventListener('online', () => this.enLinea.set(true));
    window.addEventListener('offline', () => this.enLinea.set(false));
  }
}
