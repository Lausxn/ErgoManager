import { Routes } from '@angular/router';
import { DashboardComponent } from './dashboard.component';

export const dashboardRoutes: Routes = [
    {
        path: '',
        component: DashboardComponent
    }
];

import { DashboardComponent } from './dashboard.component';

/** Routes of the administrator home page. */
export const dashboardRoutes: Routes = [{ path: '', component: DashboardComponent, title: 'ErgoManager - Inicio' }];
