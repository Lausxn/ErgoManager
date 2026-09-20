import { Routes } from '@angular/router';

import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';

/**
 * Root routes of the application. Every feature is loaded on demand, and the
 * self evaluation stays public because the employees answer it without an
 * account.
 */
export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'login',
  },
  {
    path: 'login',
    loadChildren: () => import('./features/auth/auth.routes').then((m) => m.authRoutes),
  },
  {
    path: 'self-evaluation',
    loadChildren: () =>
      import('./features/self-evaluation/self-evaluation.routes').then((m) => m.selfEvaluationRoutes),
  },
  {
    path: 'companies',
    canActivate: [authGuard, roleGuard(['ADMIN'])],
    loadChildren: () => import('./features/companies/companies.routes').then((m) => m.companiesRoutes),
  },
  {
    path: 'users',
    canActivate: [authGuard, roleGuard(['ADMIN'])],
    loadChildren: () => import('./features/users/users.routes').then((m) => m.usersRoutes),
  },
  {
    path: 'forms',
    canActivate: [authGuard, roleGuard(['ADMIN'])],
    loadChildren: () => import('./features/forms/forms.routes').then((m) => m.formsRoutes),
  },
  {
    path: 'appointments',
    canActivate: [authGuard],
    loadChildren: () =>
      import('./features/appointment-scheduling/appointment-scheduling.routes').then(
        (m) => m.appointmentSchedulingRoutes,
      ),
  },
  {
    path: 'personalized-evaluations',
    canActivate: [authGuard, roleGuard(['ERGONOMIST'])],
    loadChildren: () =>
      import('./features/personalized-evaluation/personalized-evaluation.routes').then(
        (m) => m.personalizedEvaluationRoutes,
      ),
  },
  {
    path: 'history',
    canActivate: [authGuard],
    loadChildren: () => import('./features/history/history.routes').then((m) => m.historyRoutes),
  },
  {
    path: '**',
    redirectTo: 'login',
  },
];
