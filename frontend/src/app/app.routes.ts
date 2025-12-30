import { Routes } from '@angular/router';
import { authGuard } from './guards/auth-guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/landing/landing').then((m) => m.Landing),
  },
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login').then((m) => m.Login),
  },
  {
    path: 'cockpit',
    loadComponent: () => import('./pages/dashboard/dashboard').then((m) => m.Dashboard),
    canActivate: [authGuard],
  },
  {
    path: 'users',
    loadComponent: () => import('./pages/users/users').then((m) => m.Users),
    canActivate: [authGuard],
  },
  {
    path: 'files',
    loadComponent: () => import('./pages/files/files').then((m) => m.Files),
  },
  {
    path: 'network-map',
    loadComponent: () => import('./pages/network-map/network-map').then((m) => m.NetworkMap),
    canActivate: [authGuard],
  },
  {
    path: 'game',
    loadComponent: () => import('./pages/game/game').then((m) => m.Game),
  },
  {
    path: 'game-admin',
    loadComponent: () => import('./pages/game-admin/game-admin').then((m) => m.GameAdmin),
    canActivate: [authGuard],
  },
  { path: '**', redirectTo: '/' },
];
