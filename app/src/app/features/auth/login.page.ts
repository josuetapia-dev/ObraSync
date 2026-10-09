import { Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';

import { environment } from '../../../environments/environment';
import { Auth, ErrorLogin } from '../../core/auth/auth';
import { Red } from '../../core/red';

type Campo = 'email' | 'password';

@Component({
  selector: 'app-login',
  templateUrl: 'login.page.html',
  styleUrls: ['login.page.scss'],
  standalone: false,
})
export class LoginPage {

  private fb = inject(FormBuilder);
  private auth = inject(Auth);
  private router = inject(Router);
  private host = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly red = inject(Red);

  readonly cargando = signal(false);
  readonly verPassword = signal(false);
  readonly error = signal('');
  readonly mostrarDemo = environment.mostrarCuentasDemo;

  /** Cuentas de prueba creadas por el seeder de Laravel (contraseña: "password"). */
  readonly cuentasDemo = [
    { rol: 'Trabajador', email: 'trabajador@obrasync.test' },
    { rol: 'Mayordomo', email: 'mayordomo@obrasync.test' },
    { rol: 'Admin', email: 'admin@obrasync.test' },
  ];

  private alerta = viewChild<ElementRef<HTMLElement>>('alerta');

  form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  /** Error junto al campo, solo después de que el usuario lo tocó. */
  errorDe(campo: Campo): string {
    const c = this.form.controls[campo];
    if (!c.touched || c.valid) return '';
    if (c.hasError('required')) return campo === 'email' ? 'Escribe tu correo.' : 'Escribe tu contraseña.';
    if (c.hasError('email')) return 'Revisa el formato, p. ej. nombre@empresa.com';
    return '';
  }

  usarCuenta(email: string) {
    this.form.setValue({ email, password: 'password' });
    this.error.set('');
  }

  async entrar() {
    this.error.set('');

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      const primero = this.form.controls.email.invalid ? 'email' : 'password';
      this.host.nativeElement.querySelector<HTMLInputElement>(`#${primero}`)?.focus();
      return;
    }

    this.cargando.set(true);
    try {
      const { email, password } = this.form.getRawValue();
      await this.auth.iniciarSesion(email, password);
      this.form.reset();
      this.router.navigateByUrl('/tabs/obras', { replaceUrl: true });
    } catch (e) {
      this.error.set(e instanceof ErrorLogin ? e.message : 'No se pudo iniciar sesión.');
      queueMicrotask(() => this.alerta()?.nativeElement.focus());
    } finally {
      this.cargando.set(false);
    }
  }
}
