import { Component, inject, signal } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { AlertController, NavController, ToastController } from '@ionic/angular/lazy';

import { Auth } from '../../core/auth/auth';
import { Red } from '../../core/red';
import { Sincronizador } from '../../core/sync/sincronizador';
import { Obra } from '../obras/obra.model';
import { ObrasService } from '../obras/obras.service';
import { CATEGORIAS, Categoria, EntradaBitacora, puedeEditar } from './bitacora.model';
import { BitacoraRepository } from './bitacora.repository';

type Campo = 'titulo' | 'descripcion' | 'fecha';

/** Fecha local de hoy en formato YYYY-MM-DD (no UTC: en México de noche UTC ya es "mañana"). */
function hoy(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Crear, editar o borrar una nota. Se guarda en SQLite al instante; el envío va después. */
@Component({
  selector: 'app-bitacora-form',
  templateUrl: 'bitacora-form.page.html',
  styleUrls: ['bitacora-form.page.scss'],
  standalone: false,
})
export class BitacoraFormPage {

  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private nav = inject(NavController);
  private alert = inject(AlertController);
  private toast = inject(ToastController);
  private repo = inject(BitacoraRepository);
  private obrasService = inject(ObrasService);
  private auth = inject(Auth);
  private sync = inject(Sincronizador);
  readonly red = inject(Red);

  readonly categorias = CATEGORIAS;
  readonly maxDescripcion = 2000;
  readonly hoy = hoy();

  readonly obras = signal<Obra[]>([]);
  readonly entrada = signal<EntradaBitacora | null>(null);
  readonly esNueva = signal(true);
  readonly noEncontrada = signal(false);
  readonly soloLectura = signal(false);
  readonly guardando = signal(false);

  form = this.fb.nonNullable.group({
    obraId: [0, [Validators.required, Validators.min(1)]],
    categoria: ['avance' as Categoria, Validators.required],
    titulo: ['', [Validators.required, Validators.maxLength(120)]],
    descripcion: ['', Validators.maxLength(this.maxDescripcion)],
    fecha: [hoy(), Validators.required],
  });

  async ionViewWillEnter() {
    const id = this.route.snapshot.paramMap.get('id');
    this.obras.set(await this.obrasService.listarLocales());
    this.form.enable();
    this.soloLectura.set(false);
    this.noEncontrada.set(false);

    if (!id) {
      this.esNueva.set(true);
      this.entrada.set(null);
      this.form.reset({ obraId: this.obras()[0]?.id ?? 0, categoria: 'avance', titulo: '', descripcion: '', fecha: hoy() });
      return;
    }

    this.esNueva.set(false);
    const e = await this.repo.obtener(id);
    if (!e || e.eliminado) {
      this.noEncontrada.set(true);
      return;
    }
    this.entrada.set(e);
    this.form.reset({ obraId: e.obra_id, categoria: e.categoria, titulo: e.titulo, descripcion: e.descripcion ?? '', fecha: e.fecha });

    if (!puedeEditar(e, this.auth.usuario())) {
      this.soloLectura.set(true);
      this.form.disable();
    }
  }

  nombreObra(id: number) {
    return this.obras().find(o => o.id === id)?.nombre ?? 'Obra';
  }

  /** Error junto al campo, solo después de tocarlo. */
  errorDe(campo: Campo): string {
    const c = this.form.controls[campo];
    if (!c.touched || c.valid) return '';
    if (c.hasError('required')) return campo === 'titulo' ? 'Escribe un título.' : 'Elige una fecha.';
    if (c.hasError('maxlength')) return `Máximo ${c.getError('maxlength').requiredLength} caracteres.`;
    return '';
  }

  async guardar() {
    const usuario = this.auth.usuario();
    if (!usuario || this.soloLectura()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.guardando.set(true);
    try {
      const v = this.form.getRawValue();
      const datos = {
        categoria: v.categoria,
        titulo: v.titulo.trim(),
        descripcion: v.descripcion.trim() || null,
        fecha: v.fecha,
      };
      const e = this.entrada();
      if (e) {
        await this.repo.actualizar(e.local_id, datos, usuario);
      } else {
        await this.repo.crear({ ...datos, obraId: v.obraId }, usuario);
      }
      await this.terminar(e ? 'Nota actualizada' : 'Nota guardada');
    } finally {
      this.guardando.set(false);
    }
  }

  async confirmarEliminar() {
    const e = this.entrada();
    const usuario = this.auth.usuario();
    if (!e || !usuario) return;

    const a = await this.alert.create({
      header: '¿Borrar esta nota?',
      message: 'También se borrará en los teléfonos de tu cuadrilla.',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Borrar', role: 'destructive' },
      ],
    });
    await a.present();
    if ((await a.onDidDismiss()).role !== 'destructive') return;

    await this.repo.eliminar(e.local_id, usuario);
    await this.terminar('Nota borrada');
  }

  /** Regresa a la lista, cuenta pendientes, intenta enviar en segundo plano y avisa. */
  private async terminar(mensaje: string) {
    this.nav.navigateBack('/tabs/bitacora');
    await this.sync.contar();
    this.sync.sincronizar();
    const t = await this.toast.create({
      message: mensaje + (this.red.enLinea() ? '.' : ' en el teléfono. Se enviará al volver la señal.'),
      duration: 3000,
      position: 'bottom',
      positionAnchor: 'tab-bar',
      icon: 'checkmark-circle-outline',
    });
    await t.present();
  }
}
