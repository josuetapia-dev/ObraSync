import {
  Component,
  ElementRef,
  Injector,
  OnDestroy,
  afterNextRender,
  effect,
  inject,
  input,
  untracked,
  viewChild,
} from '@angular/core';
import * as L from 'leaflet';

import { Red } from '../../../core/red';

/**
 * Mapa de OpenStreetMap (Leaflet) con la obra y su radio permitido para checar.
 * Los mapas necesitan internet para dibujarse: sin conexión se muestra un aviso
 * y se dibuja solo al volver la red.
 */
@Component({
  selector: 'app-mapa-obra',
  standalone: false,
  template: `
    <div class="mapa-wrap">
      <div
        #contenedor
        class="mapa"
        [class.oculto]="!red.enLinea()"
        role="img"
        [attr.aria-label]="'Mapa de ' + nombre() + ' con un radio permitido de ' + radio() + ' metros'"
      ></div>
      @if (!red.enLinea()) {
        <div class="sin-red">
          <ion-icon name="cloud-offline-outline" aria-hidden="true"></ion-icon>
          <p>El mapa necesita conexión. Tus registros sí funcionan sin señal.</p>
        </div>
      }
    </div>
    <a class="cp-btn cp-btn-outline cp-block llegar" [href]="urlComoLlegar()" target="_blank" rel="noopener">
      <ion-icon name="navigate-outline" aria-hidden="true"></ion-icon> Cómo llegar
    </a>
  `,
  styles: [`
    .mapa-wrap { position: relative; border-radius: var(--cp-radius); overflow: hidden; border: 1px solid var(--cp-divider); }
    .mapa { height: 220px; background: var(--cp-hover); }
    .mapa.oculto { visibility: hidden; }
    .sin-red {
      position: absolute; inset: 0;
      display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px;
      padding: 16px; text-align: center; color: var(--cp-muted); font-size: 0.875rem;
      ion-icon { font-size: 28px; }
      p { margin: 0; max-width: 28ch; }
    }
    .llegar { margin-top: 10px; text-decoration: none; }
  `],
})
export class MapaObraComponent implements OnDestroy {

  readonly lat = input.required<number>();
  readonly lng = input.required<number>();
  readonly radio = input.required<number>();
  readonly nombre = input<string>('la obra');

  readonly red = inject(Red);
  private contenedor = viewChild.required<ElementRef<HTMLDivElement>>('contenedor');
  private injector = inject(Injector);
  private mapa?: L.Map;
  private limites?: L.LatLngBounds;
  private observador?: ResizeObserver;

  constructor() {
    afterNextRender(() => {
      // Dibuja cuando hay red (y de nuevo si vuelve después de estar offline).
      effect(() => {
        if (this.red.enLinea()) untracked(() => this.dibujar());
      }, { injector: this.injector });
    });
  }

  /** Abre Google Maps (o la app de mapas del celular) con indicaciones hasta la obra. */
  urlComoLlegar(): string {
    return `https://www.google.com/maps/dir/?api=1&destination=${this.lat()},${this.lng()}`;
  }

  private dibujar() {
    if (this.mapa) {
      this.encuadrar();
      return;
    }

    const color = getComputedStyle(document.documentElement).getPropertyValue('--cp-secondary').trim() || '#4f46e5';
    const centro: L.LatLngTuple = [this.lat(), this.lng()];

    // Vista inicial fija: si el contenedor aún mide 0 (animación de entrada), no queda un zoom inválido.
    this.mapa = L.map(this.contenedor().nativeElement, { zoomControl: true, attributionControl: true })
      .setView(centro, 16);

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(this.mapa);

    // Radio permitido (geocerca) y centro de la obra.
    const circulo = L.circle(centro, { radius: this.radio(), color, weight: 2, fillColor: color, fillOpacity: 0.15 }).addTo(this.mapa);
    L.circleMarker(centro, { radius: 7, color: '#ffffff', weight: 3, fillColor: color, fillOpacity: 1 })
      .bindTooltip(this.nombre())
      .addTo(this.mapa);

    this.limites = circulo.getBounds();
    this.encuadrar();

    // Ionic anima la entrada de la página: cuando el contenedor tenga su tamaño real, reencuadrar.
    this.observador = new ResizeObserver(() => this.encuadrar());
    this.observador.observe(this.contenedor().nativeElement);
  }

  /** Ajusta el mapa al círculo del radio (solo si el contenedor ya tiene tamaño). */
  private encuadrar() {
    const el = this.contenedor().nativeElement;
    if (!this.mapa || !this.limites || el.clientWidth === 0 || el.clientHeight === 0) return;
    this.mapa.invalidateSize();
    this.mapa.fitBounds(this.limites, { padding: [24, 24] });
  }

  ngOnDestroy() {
    this.observador?.disconnect();
    this.mapa?.remove();
  }
}
