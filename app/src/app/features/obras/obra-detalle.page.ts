import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { Red } from '../../core/red';
import { iconoClima } from '../../shared/clima-icono';
import { CondicionesGuardadas, Obra, Riesgo } from './obra.model';
import { ObrasService } from './obras.service';

/** Datos guardados con más de 3 h se marcan como "viejos" para que se tomen con cuidado. */
const HORAS_VIGENCIA = 3;

/** Detalle de una obra: condiciones de hoy (semáforo) y próximas horas. */
@Component({
  selector: 'app-obra-detalle',
  templateUrl: 'obra-detalle.page.html',
  styleUrls: ['obra-detalle.page.scss'],
  standalone: false,
})
export class ObraDetallePage {

  private route = inject(ActivatedRoute);
  private obrasService = inject(ObrasService);
  readonly red = inject(Red);

  readonly obra = signal<Obra | null>(null);
  readonly condiciones = signal<CondicionesGuardadas | null>(null);
  readonly actualizando = signal(false);
  readonly fallo = signal(false);
  readonly icono = iconoClima;

  readonly viejas = computed(() => {
    const c = this.condiciones();
    return !!c && Date.now() - c.guardadoEn.getTime() > HORAS_VIGENCIA * 3600_000;
  });

  /** Filas del semáforo en orden de lectura. */
  readonly riesgos = computed(() => {
    const r = this.condiciones()?.datos.riesgos;
    if (!r) return [];
    return [
      { clave: 'calor', titulo: 'Calor', icono: 'thermometer-outline', detalle: 'Índice de calor', riesgo: r.calor },
      { clave: 'lluvia', titulo: 'Lluvia', icono: 'rainy-outline', detalle: 'Prob. próximas 6 h', riesgo: r.lluvia },
      { clave: 'viento', titulo: 'Viento', icono: 'flag-outline', detalle: 'Ráfagas próximas 6 h', riesgo: r.viento },
    ] as { clave: string; titulo: string; icono: string; detalle: string; riesgo: Riesgo }[];
  });

  async ionViewWillEnter() {
    const id = Number(this.route.snapshot.paramMap.get('id'));

    // 1) Lo guardado, al instante.
    this.obra.set(await this.obrasService.obtenerLocal(id));
    this.condiciones.set(await this.obrasService.condicionesLocales(id));

    // 2) Actualizar condiciones si hay red.
    await this.actualizar(id);
  }

  async actualizar(id = this.obra()?.id) {
    if (!id) return;
    this.actualizando.set(true);
    this.fallo.set(false);
    const nuevas = await this.obrasService.refrescarCondiciones(id);
    if (nuevas) {
      this.condiciones.set(nuevas);
    } else if (this.red.enLinea()) {
      this.fallo.set(true); // hay red pero el servidor o el clima no respondieron
    }
    this.actualizando.set(false);
  }
}
