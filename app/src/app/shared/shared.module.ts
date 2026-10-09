import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular/lazy';

import { EstadoRedComponent } from './estado-red/estado-red.component';
import { SemaforoComponent } from './semaforo/semaforo.component';
import { TiempoRelativoPipe } from './tiempo-relativo.pipe';

/** Componentes y pipes reutilizados por varias pantallas. */
@NgModule({
  imports: [CommonModule, IonicModule],
  declarations: [EstadoRedComponent, SemaforoComponent, TiempoRelativoPipe],
  exports: [EstadoRedComponent, SemaforoComponent, TiempoRelativoPipe],
})
export class SharedModule {}
