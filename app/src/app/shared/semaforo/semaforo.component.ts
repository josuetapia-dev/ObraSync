import { Component, input } from '@angular/core';

import { Nivel } from '../../features/obras/obra.model';

const TEXTO: Record<Nivel, string> = { verde: 'Normal', amarillo: 'Precaución', rojo: 'Alto' };
/** Orden de las luces como en un semáforo horizontal: rojo, amarillo, verde. */
const LUCES: Nivel[] = ['rojo', 'amarillo', 'verde'];

/**
 * Mini semáforo: tres luces y se enciende la del nivel. No depende solo del color:
 * la posición de la luz y el texto dicen lo mismo (accesible para quien no distingue colores).
 */
@Component({
  selector: 'app-semaforo',
  standalone: false,
  template: `
    <span class="semaforo nivel-{{ nivel() }}" role="img"
      [attr.aria-label]="(etiqueta() ? etiqueta() + ': ' : '') + 'riesgo ' + texto[nivel()].toLowerCase()">
      <span class="luces" aria-hidden="true">
        @for (l of luces; track l) {
          <span class="luz luz-{{ l }}" [class.encendida]="l === nivel()"></span>
        }
      </span>
      <span class="texto" aria-hidden="true">
        @if (etiqueta()) { <span class="etiqueta">{{ etiqueta() }}</span> }{{ texto[nivel()] }}
      </span>
    </span>
  `,
  styles: [`
    .semaforo { display: inline-flex; align-items: center; gap: 8px; white-space: nowrap; }

    .luces {
      display: inline-flex;
      gap: 3px;
      padding: 4px 6px;
      border-radius: 999px;
      background: var(--cp-semaforo-caja);
      border: 1px solid var(--cp-divider);
    }

    .luz {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--cp-semaforo-apagada);
      transition: background var(--cp-base) var(--cp-ease), transform var(--cp-base) var(--cp-ease-spring);
    }
    .luz.encendida { transform: scale(1.15); }
    .luz-verde.encendida { background: var(--cp-semaforo-verde); }
    .luz-amarillo.encendida { background: var(--cp-semaforo-amarillo); }
    .luz-rojo.encendida { background: var(--cp-semaforo-rojo); }

    .texto { font-size: 0.8125rem; font-weight: 600; }
    .etiqueta { color: var(--cp-muted); font-weight: 500; margin-right: 6px; }
    .nivel-verde .texto { color: var(--cp-ok); }
    .nivel-amarillo .texto { color: var(--cp-warn); }
    .nivel-rojo .texto { color: var(--cp-danger); }
  `],
})
export class SemaforoComponent {
  readonly nivel = input.required<Nivel>();
  readonly etiqueta = input<string>('');
  readonly texto = TEXTO;
  readonly luces = LUCES;
}
