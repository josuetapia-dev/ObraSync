import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';

import { authGuard, invitadoGuard } from './core/auth/guards';

const routes: Routes = [
  {
    path: 'login',
    canActivate: [invitadoGuard],
    loadChildren: () => import('./features/auth/login.module').then(m => m.LoginPageModule)
  },
  {
    path: '',
    canActivate: [authGuard],
    loadChildren: () => import('./tabs/tabs.module').then(m => m.TabsPageModule)
  },
  { path: '**', redirectTo: '' }
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules })
  ],
  exports: [RouterModule]
})
export class AppRoutingModule {}
