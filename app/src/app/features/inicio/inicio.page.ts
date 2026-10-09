import { Component, inject } from '@angular/core';

import { Auth } from '../../core/auth/auth';

/** Pantalla de inicio (se reemplaza por "Mis obras" en la rama feat/obras). */
@Component({
  selector: 'app-inicio',
  templateUrl: 'inicio.page.html',
  styleUrls: ['inicio.page.scss'],
  standalone: false,
})
export class InicioPage {
  readonly usuario = inject(Auth).usuario;
}
