import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { IonicModule } from '@ionic/angular/lazy';

import { SharedModule } from '../../shared/shared.module';
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
  declarations: [ObrasPage, ObraDetallePage],
})
export class ObrasPageModule {}
