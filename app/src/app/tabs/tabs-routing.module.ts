import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { TabsPage } from './tabs.page';

const routes: Routes = [
  {
    path: 'tabs',
    component: TabsPage,
    children: [
      {
        path: 'obras',
        loadChildren: () => import('../features/obras/obras.module').then(m => m.ObrasPageModule)
      },
      {
        path: 'checar',
        loadChildren: () => import('../features/asistencia/asistencia.module').then(m => m.AsistenciaPageModule)
      },
      {
        path: 'perfil',
        loadChildren: () => import('../features/perfil/perfil.module').then(m => m.PerfilPageModule)
      },
      {
        path: '',
        redirectTo: '/tabs/obras',
        pathMatch: 'full'
      }
    ]
  },
  {
    path: '',
    redirectTo: '/tabs/obras',
    pathMatch: 'full'
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
})
export class TabsPageRoutingModule {}
