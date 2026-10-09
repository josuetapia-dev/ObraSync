import { Component, computed, effect, inject, signal, untracked } from '@angular/core';

import { Auth } from '../../core/auth/auth';
import { Red } from '../../core/red';
import { Sincronizador } from '../../core/sync/sincronizador';
import { Obra } from '../obras/obra.model';
import { ObrasService } from '../obras/obras.service';
import { CATEGORIA, CATEGORIAS, Categoria, EntradaBitacora } from './bitacora.model';
import { BitacoraRepository } from './bitacora.repository';

/**
 * Bitácora de obra: lista con búsqueda y filtros.
 * Todo se consulta en SQLite, así que funciona igual con o sin señal.
 */
@Component({
  selector: 'app-bitacora',
  templateUrl: 'bitacora.page.html',
  styleUrls: ['bitacora.page.scss'],
  standalone: false,
})
export class BitacoraPage {

  private repo = inject(BitacoraRepository);
  private obrasService = inject(ObrasService);
  private auth = inject(Auth);
  readonly sync = inject(Sincronizador);
  readonly red = inject(Red);

  readonly categorias = CATEGORIAS;
  readonly categoria = CATEGORIA;

  readonly obras = signal<Obra[]>([]);
  readonly entradas = signal<EntradaBitacora[]>([]);
  readonly cargando = signal(true);

  // Filtros
  readonly texto = signal('');
  readonly filtroCategoria = signal<Categoria | null>(null);
  readonly filtroObra = signal<number | null>(null);
  readonly soloPendientes = signal(false);

  readonly hayFiltros = computed(() =>
    !!this.texto().trim() || !!this.filtroCategoria() || !!this.filtroObra() || this.soloPendientes());

  readonly nombres = computed(() => new Map(this.obras().map(o => [o.id, o.nombre])));

  private visible = false;
  private espera?: ReturnType<typeof setTimeout>;
  private ultimaConsulta = 0;

  constructor() {
    // Al terminar una sincronización (llegan notas de la cuadrilla), refrescar la lista.
    effect(() => {
      if (!this.sync.sincronizando()) {
        untracked(() => { if (this.visible) this.buscar(); });
      }
    });
  }

  async ionViewWillEnter() {
    this.visible = true;
    this.obras.set(await this.obrasService.listarLocales());
    await this.buscar();
    this.cargando.set(false);
    this.sync.sincronizar(); // trae lo nuevo de la cuadrilla (si hay red)
  }

  ionViewWillLeave() {
    this.visible = false;
  }

  /**
   * Consulta SQLite con los filtros actuales. Si mientras tanto empezó otra consulta,
   * esta respuesta se descarta (si no, una consulta vieja podría pisar a la nueva).
   */
  async buscar() {
    const consulta = ++this.ultimaConsulta;
    const obraIds = this.obras().map(o => o.id);
    const resultado = await this.repo.listar(obraIds, {
      texto: this.texto(),
      categoria: this.filtroCategoria(),
      obraId: this.filtroObra(),
      soloPendientes: this.soloPendientes(),
    });
    if (consulta === this.ultimaConsulta) this.entradas.set(resultado);
  }

  /** Mientras se escribe, espera un poco antes de consultar (no una consulta por tecla). */
  escribir(valor: string) {
    this.texto.set(valor);
    clearTimeout(this.espera);
    this.espera = setTimeout(() => this.buscar(), 200);
  }

  elegirCategoria(c: Categoria | null) {
    this.filtroCategoria.set(this.filtroCategoria() === c ? null : c);
    this.buscar();
  }

  elegirObra(valor: string) {
    this.filtroObra.set(valor ? Number(valor) : null);
    this.buscar();
  }

  alternarPendientes() {
    this.soloPendientes.update(v => !v);
    this.buscar();
  }

  limpiarFiltros() {
    this.texto.set('');
    this.filtroCategoria.set(null);
    this.filtroObra.set(null);
    this.soloPendientes.set(false);
    this.buscar();
  }

  async refrescar(event: CustomEvent) {
    await this.sync.sincronizar();
    await this.buscar();
    (event.target as HTMLIonRefresherElement).complete();
  }

  /** Etiqueta de sincronización de cada nota (null = al día). */
  estado(e: EntradaBitacora): { clase: string; icono: string; texto: string } | null {
    switch (e.sync_status) {
      case 'pending': return { clase: 'warn', icono: 'cloud-upload-outline', texto: 'Sin enviar' };
      case 'error': return { clase: 'warn', icono: 'sync-outline', texto: 'Reintentando' };
      case 'rechazado': return { clase: 'danger', icono: 'close-circle-outline', texto: 'Rechazada' };
    }
    if (e.conflicto) {
      return { clase: 'info', icono: 'swap-horizontal-outline', texto: `Quedó la versión de ${e.editado_por_nombre ?? 'otra persona'}` };
    }
    return null;
  }

  esMia(e: EntradaBitacora) {
    return e.autor_id === this.auth.usuario()?.id;
  }
}
