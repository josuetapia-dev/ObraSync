import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { IonicModule } from '@ionic/angular/lazy';

import { SharedModule } from '../../shared/shared.module';
import { MapaObraComponent } from './mapa-obra/mapa-obra.component';
import { ObraDetallePage } from './obra-detalle.page';
import { ObrasPage } from './obras.page';

@NgModule({
  imports: [
    CommonModule,
    IonicModule,
    SharedModule,
    RouterModule.forChild([
      { path: '', component: ObrasPage },
      { path: ':id', component: ObraDetallePage },
    ]),
  ],
  // El mapa (Leaflet) solo se usa aquí: así no se descarga al abrir otras pantallas.
  declarations: [ObrasPage, ObraDetallePage, MapaObraComponent],
})
export class ObrasPageModule {}
