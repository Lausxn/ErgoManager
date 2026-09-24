import { Routes } from '@angular/router';
import { authGuard } from './app/core/guards/auth.guard';
import { homeRedirect } from './app/core/guards/redirect-to-home';
import { roleGuard } from './app/core/guards/role.guard';
import { AppLayout } from './app/layout/component/app.layout';
import { Notfound } from './app/pages/notfound/notfound';

/**
 * Root routes. Everything inside the layout needs a session, and some
 * features also need a role. The self evaluation stays public because the
 * employees answer it without an account.
 */
export const appRoutes: Routes = [
    {
        path: '',
        component: AppLayout,
        canActivate: [authGuard],
        canActivateChild: [authGuard],
        children: [
            { path: '', pathMatch: 'full', redirectTo: homeRedirect },
            {
                path: 'companies',
                canActivate: [roleGuard(['ADMIN'])],
                loadChildren: () => import('./app/pages/companies/companies.routes').then((m) => m.companiesRoutes)
            },
            {
                path: 'users',
                canActivate: [roleGuard(['ADMIN'])],
                loadChildren: () => import('./app/pages/users/users.routes').then((m) => m.usersRoutes)
            },
            {
                path: 'forms',
                canActivate: [roleGuard(['ADMIN'])],
                loadChildren: () => import('./app/pages/forms/forms.routes').then((m) => m.formsRoutes)
            },
            {
                path: 'appointments',
                loadChildren: () => import('./app/pages/appointment-scheduling/appointment-scheduling.routes').then((m) => m.appointmentSchedulingRoutes)
            },
            {
                path: 'personalized-evaluations',
                canActivate: [roleGuard(['ERGONOMIST'])],
                loadChildren: () => import('./app/pages/personalized-evaluation/personalized-evaluation.routes').then((m) => m.personalizedEvaluationRoutes)
            },
            {
                path: 'history',
                loadChildren: () => import('./app/pages/history/history.routes').then((m) => m.historyRoutes)
            }
        ]
    },
    {
        path: 'self-evaluation',
        loadChildren: () => import('./app/pages/self-evaluation/self-evaluation.routes').then((m) => m.selfEvaluationRoutes)
    },
    { path: 'auth', loadChildren: () => import('./app/pages/auth/auth.routes') },
    { path: 'notfound', component: Notfound, title: 'ErgoManager - Página no encontrada' },
    { path: '**', redirectTo: '/notfound' }
];
