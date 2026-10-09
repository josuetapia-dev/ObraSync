import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController } from '@ionic/angular/lazy';

import { Auth } from '../../core/auth/auth';
import { Red } from '../../core/red';
import { Sincronizador } from '../../core/sync/sincronizador';

/** Datos de la cuenta y cierre de sesión. */
@Component({
  selector: 'app-perfil',
  templateUrl: 'perfil.page.html',
  styleUrls: ['perfil.page.scss'],
  standalone: false,
})
export class PerfilPage {

  private auth = inject(Auth);
  private router = inject(Router);
  private alert = inject(AlertController);
  readonly red = inject(Red);
  private sync = inject(Sincronizador);

  readonly usuario = this.auth.usuario;

  readonly iniciales = computed(() =>
    (this.usuario()?.nombre ?? '?')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map(p => p[0].toUpperCase())
      .join('')
  );

  async confirmarSalida() {
    const sinRed = !this.red.enLinea();
    const pendientes = this.sync.pendientes();
    const a = await this.alert.create({
      header: '¿Cerrar sesión?',
      message: pendientes > 0
        ? `Tienes ${pendientes} ${pendientes === 1 ? 'registro' : 'registros'} sin enviar. Se guardan en este teléfono y se enviarán cuando vuelvas a entrar con tu cuenta.`
        : sinRed
          ? 'Estás sin conexión: para volver a entrar necesitarás internet.'
          : 'Podrás volver a entrar con tu correo y contraseña.',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Cerrar sesión', role: 'destructive', handler: () => { this.salir(); } },
      ],
    });
    await a.present();
  }

  private async salir() {
    await this.auth.cerrarSesion();
    this.router.navigateByUrl('/login', { replaceUrl: true });
  }
}
