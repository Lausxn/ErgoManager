import { Routes } from '@angular/router';

import { DashboardComponent } from './dashboard.component';

/** Routes of the home page of administrators and ergonomists. */
export const dashboardRoutes: Routes = [{ path: '', component: DashboardComponent, title: 'ErgoManager - Inicio' }];
