import { Component, inject } from '@angular/core';

import { Red } from '../../core/red';

/** Etiqueta en la barra superior con el estado de la conexión. */
@Component({
  selector: 'app-estado-red',
  standalone: false,
  template: `
    <div class="wrap" role="status">
      @if (red.enLinea()) {
        <span class="cp-chip ok"><ion-icon name="wifi" aria-hidden="true"></ion-icon>En línea</span>
      } @else {
        <span class="cp-chip danger"><ion-icon name="cloud-offline-outline" class="cp-pulse" aria-hidden="true"></ion-icon>Sin conexión</span>
      }
    </div>
  `,
  styles: [`
    .wrap { display: flex; gap: 6px; align-items: center; padding-right: 12px; }
  `],
})
export class EstadoRedComponent {
  readonly red = inject(Red);
}
