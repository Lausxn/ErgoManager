import { Routes } from '@angular/router';

import { LoginComponent } from './login/login.component';

/** Routes of the sign in feature. */
export const authRoutes: Routes = [
  {
    path: '',
    component: LoginComponent,
    title: 'ErgoManager - Sign in',
  },
];
