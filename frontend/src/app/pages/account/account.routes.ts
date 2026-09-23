import { Routes } from '@angular/router';

import { UpdatePasswordComponent } from './update-password/update-password.component';

/** Url of the password update page, used by the popup that opens it. */
export const UPDATE_PASSWORD_URL = '/account/password';

/** Routes of the signed in user's own account. */
export const accountRoutes: Routes = [
    { path: '', pathMatch: 'full', redirectTo: 'password' },
    { path: 'password', component: UpdatePasswordComponent, title: 'ErgoManager - Actualizar contraseña' }
];
