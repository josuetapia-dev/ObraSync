import { Component, input } from '@angular/core';

import { Nivel } from '../../features/obras/obra.model';

const TEXTO: Record<Nivel, string> = { verde: 'Normal', amarillo: 'Precaución', rojo: 'Alto' };
const ICONO: Record<Nivel, string> = {
  verde: 'checkmark-circle-outline',
  amarillo: 'warning-outline',
  rojo: 'alert-circle-outline',
};

/**
 * Indicador de nivel de riesgo. No depende solo del color: lleva icono y texto
 * (accesible para quien no distingue colores).
 */
@Component({
  selector: 'app-semaforo',
  standalone: false,
  template: `
    <span class="cp-chip nivel-{{ nivel() }}" [attr.aria-label]="(etiqueta() ? etiqueta() + ': ' : '') + 'riesgo ' + texto[nivel()].toLowerCase()">
      <ion-icon [name]="icono[nivel()]" aria-hidden="true"></ion-icon>
      @if (etiqueta()) { {{ etiqueta() }} · }{{ texto[nivel()] }}
    </span>
  `,
  styles: [`
    .nivel-verde { color: var(--cp-ok); background: var(--cp-ok-bg); }
    .nivel-amarillo { color: var(--cp-warn); background: var(--cp-warn-bg); }
    .nivel-rojo { color: var(--cp-danger); background: var(--cp-danger-bg); }
  `],
})
export class SemaforoComponent {
  readonly nivel = input.required<Nivel>();
  readonly etiqueta = input<string>('');
  readonly texto = TEXTO;
  readonly icono = ICONO;
}
