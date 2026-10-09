import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular/lazy';

import { EstadoRedComponent } from './estado-red/estado-red.component';

/** Componentes reutilizados por varias pestañas. */
@NgModule({
  imports: [CommonModule, IonicModule],
  declarations: [EstadoRedComponent],
  exports: [EstadoRedComponent],
})
export class SharedModule {}
