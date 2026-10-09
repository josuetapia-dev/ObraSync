import { Component, inject } from '@angular/core';

import { Red } from '../../core/red';
import { Sincronizador } from '../../core/sync/sincronizador';

/** Etiqueta en la barra superior: conexión y registros pendientes de enviar. */
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
      @if (sync.sincronizando()) {
        <span class="cp-chip warn"><ion-icon name="sync-outline" class="cp-spin" aria-hidden="true"></ion-icon>Enviando</span>
      } @else if (sync.pendientes() > 0) {
        <span class="cp-chip warn">{{ sync.pendientes() }} sin enviar</span>
      }
    </div>
  `,
  styles: [`
    .wrap { display: flex; gap: 6px; align-items: center; padding-right: 12px; }
  `],
})
export class EstadoRedComponent {
  readonly red = inject(Red);
  readonly sync = inject(Sincronizador);
}
