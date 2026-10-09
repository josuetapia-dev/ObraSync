import { Component, inject } from '@angular/core';

import { Red } from '../../core/red';
import { Sincronizador } from '../../core/sync/sincronizador';

/**
 * Estado en la barra superior: conexión y registros por enviar.
 * Pastilla neutra con un punto de color (no compite con el título); el punto parpadea
 * sin señal y el icono gira mientras envía.
 */
@Component({
  selector: 'app-estado-red',
  standalone: false,
  template: `
    <div class="wrap" role="status">
      <span class="estado">
        <span class="punto" [class.ok]="red.enLinea()" [class.cp-pulse]="!red.enLinea()" aria-hidden="true"></span>
        {{ red.enLinea() ? 'En línea' : 'Sin conexión' }}
      </span>
      @if (sync.sincronizando()) {
        <span class="estado"><ion-icon name="sync-outline" class="cp-spin icono" aria-hidden="true"></ion-icon>Enviando</span>
      } @else if (sync.pendientes() > 0) {
        <span class="estado"><ion-icon name="cloud-upload-outline" class="icono" aria-hidden="true"></ion-icon>{{ sync.pendientes() }} sin enviar</span>
      }
    </div>
  `,
  styles: [`
    .wrap { display: flex; gap: 6px; align-items: center; padding-right: 12px; }

    .estado {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      border-radius: 999px;
      border: 1px solid var(--cp-divider);
      background: var(--cp-surface);
      color: var(--cp-fg);
      font-size: 0.8125rem;
      font-weight: 600;
      white-space: nowrap;
      animation: cp-pop var(--cp-base) var(--cp-ease-spring) both;
    }

    .punto { width: 8px; height: 8px; border-radius: 50%; background: var(--cp-luz-rojo); }
    .punto.ok { background: var(--cp-luz-verde); }
    .icono { font-size: 15px; color: var(--cp-warn); }
  `],
})
export class EstadoRedComponent {
  readonly red = inject(Red);
  readonly sync = inject(Sincronizador);
}
