import { Component, inject } from '@angular/core';

import { Estado } from '../../services/estado';

/** Etiqueta en la barra superior: conexión y número de ventas pendientes. */
@Component({
  selector: 'app-estado-red',
  standalone: false,
  template: `
    <div class="wrap" role="status">
      @if (estado.enLinea()) {
        <span class="cp-chip ok"><ion-icon name="wifi" aria-hidden="true"></ion-icon>En línea</span>
      } @else {
        <span class="cp-chip danger"><ion-icon name="cloud-offline-outline" class="cp-pulse" aria-hidden="true"></ion-icon>Sin conexión</span>
      }
      @if (estado.sincronizando()) {
        <span class="cp-chip warn"><ion-icon name="sync-outline" class="cp-spin" aria-hidden="true"></ion-icon>Sincronizando</span>
      } @else if (estado.pendientes() > 0) {
        <span class="cp-chip warn">{{ estado.pendientes() }} {{ estado.pendientes() === 1 ? 'pendiente' : 'pendientes' }}</span>
      }
    </div>
  `,
  styles: [`
    .wrap { display: flex; gap: 6px; align-items: center; padding-right: 12px; }
  `],
})
export class EstadoRedComponent {
  readonly estado = inject(Estado);
}
