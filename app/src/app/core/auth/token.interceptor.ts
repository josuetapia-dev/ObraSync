import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

import { environment } from '../../../environments/environment';
import { Auth } from './auth';

/**
 * Agrega el token a cada petición hacia la API de ObraSync.
 * Si Laravel responde 401 (token vencido o revocado), cierra la sesión y manda al login.
 */
export const tokenInterceptor: HttpInterceptorFn = (req, next) => {

  // Solo para nuestra API (nunca mandar el token a OpenWeather u otros servicios).
  if (!req.url.startsWith(environment.apiUrl)) {
    return next(req);
  }

  const auth = inject(Auth);
  const router = inject(Router);

  const conToken = req.clone({
    setHeaders: {
      Accept: 'application/json',
      ...(auth.token ? { Authorization: `Bearer ${auth.token}` } : {}),
    },
  });

  return next(conToken).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && error.status === 401 && !req.url.endsWith('/login')) {
        auth.limpiar();
        router.navigateByUrl('/login', { replaceUrl: true });
      }
      return throwError(() => error);
    })
  );
};
