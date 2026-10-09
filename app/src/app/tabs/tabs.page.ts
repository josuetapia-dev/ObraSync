import { Component, inject } from '@angular/core';

import { Estado } from '../services/estado';

@Component({
  selector: 'app-tabs',
  templateUrl: 'tabs.page.html',
  styleUrls: ['tabs.page.scss'],
  standalone: false,
})
export class TabsPage {
  // Para mostrar el número de ventas pendientes en la pestaña Sincronizar.
  readonly estado = inject(Estado);
}
