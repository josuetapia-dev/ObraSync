import { Component, inject, signal } from '@angular/core';

import { Auth } from '../../core/auth/auth';
import { Red } from '../../core/red';
import { Nivel, Obra } from './obra.model';
import { ObrasService } from './obras.service';

/** "Mis obras": lista cache-first con el semáforo de condiciones de cada una. */
@Component({
  selector: 'app-obras',
  templateUrl: 'obras.page.html',
  styleUrls: ['obras.page.scss'],
  standalone: false,
})
export class ObrasPage {

  private obrasService = inject(ObrasService);
  readonly red = inject(Red);
  readonly usuario = inject(Auth).usuario;

  readonly obras = signal<Obra[]>([]);
  readonly niveles = signal<Record<number, Nivel>>({});
  readonly cargando = signal(true);
  readonly actualizando = signal(false);
  readonly ultimaActualizacion = signal<Date | null>(null);

  ionViewWillEnter() {
    this.cargar();
  }

  /** 1) Muestra lo guardado. 2) Refresca obras y condiciones en segundo plano. */
  async cargar() {
    await this.mostrarLocal();
    this.cargando.set(false);

    this.actualizando.set(true);
    if (await this.obrasService.refrescarObras()) {
      await this.mostrarLocal();
    }
    this.actualizando.set(false);

    // Condiciones de cada obra (Laravel las tiene en caché: es rápido).
    for (const obra of this.obras()) {
      const c = await this.obrasService.refrescarCondiciones(obra.id);
      if (c) this.niveles.update(n => ({ ...n, [obra.id]: c.datos.nivel }));
    }
  }

  async refrescar(event: CustomEvent) {
    await this.cargar();
    (event.target as HTMLIonRefresherElement).complete();
  }

  private async mostrarLocal() {
    const obras = await this.obrasService.listarLocales();
    this.obras.set(obras);
    this.ultimaActualizacion.set(await this.obrasService.ultimaActualizacion());

    const niveles: Record<number, Nivel> = {};
    for (const o of obras) {
      const c = await this.obrasService.condicionesLocales(o.id);
      if (c) niveles[o.id] = c.datos.nivel;
    }
    this.niveles.set(niveles);
  }
}
