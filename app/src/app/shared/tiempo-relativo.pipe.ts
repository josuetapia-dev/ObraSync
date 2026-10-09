import { Pipe, PipeTransform } from '@angular/core';

/** "hace 5 min", "hace 2 h", "hace 3 días": para mostrar qué tan viejos son los datos guardados. */
@Pipe({ name: 'tiempoRelativo', standalone: false })
export class TiempoRelativoPipe implements PipeTransform {
  transform(fecha: Date | string | null | undefined): string {
    if (!fecha) return '';
    const seg = Math.max(0, (Date.now() - new Date(fecha).getTime()) / 1000);
    if (seg < 60) return 'hace un momento';
    const min = Math.floor(seg / 60);
    if (min < 60) return `hace ${min} min`;
    const h = Math.floor(min / 60);
    if (h < 24) return `hace ${h} h`;
    const d = Math.floor(h / 24);
    return d === 1 ? 'hace 1 día' : `hace ${d} días`;
  }
}
