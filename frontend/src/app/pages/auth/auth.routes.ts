import { Routes } from '@angular/router';
import { guestGuard } from '../../core/guards/guest.guard';
import { AccessComponent } from './access';
import { ErrorPageComponent } from './error';
import { LoginComponent } from './login/login.component';

export default [
    { path: '', pathMatch: 'full', redirectTo: 'login' },
    { path: 'login', component: LoginComponent, canActivate: [guestGuard], title: 'ErgoManager - Iniciar sesión' },
    { path: 'access', component: AccessComponent, title: 'ErgoManager - Acceso denegado' },
    { path: 'error', component: ErrorPageComponent, title: 'ErgoManager - Error' }
] as Routes;
