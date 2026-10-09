import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { IonicModule } from '@ionic/angular/lazy';

import { SharedModule } from '../../shared/shared.module';
import { BitacoraFormPage } from './bitacora-form.page';
import { BitacoraPage } from './bitacora.page';

@NgModule({
  imports: [
    CommonModule,
    ReactiveFormsModule,
    IonicModule,
    SharedModule,
    RouterModule.forChild([
      { path: '', component: BitacoraPage },
      { path: 'nueva', component: BitacoraFormPage },
      { path: ':id', component: BitacoraFormPage },
    ]),
  ],
  declarations: [BitacoraPage, BitacoraFormPage],
})
export class BitacoraPageModule {}
