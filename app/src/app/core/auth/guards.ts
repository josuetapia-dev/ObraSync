import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { Auth } from './auth';

/** Solo entra con sesión (funciona offline: la sesión está guardada en el dispositivo). */
export const authGuard: CanActivateFn = () =>
  inject(Auth).autenticado() ? true : inject(Router).createUrlTree(['/login']);

/** Si ya hay sesión, el login no se muestra. */
export const invitadoGuard: CanActivateFn = () =>
  inject(Auth).autenticado() ? inject(Router).createUrlTree(['/tabs/obras']) : true;
