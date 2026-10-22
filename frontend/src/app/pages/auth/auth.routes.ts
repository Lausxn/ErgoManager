import { Routes } from '@angular/router';
import { guestGuard } from '../../core/guards/guest.guard';
import { Access } from './access';
import { Error } from './error';
import { LoginComponent } from './login/login.component';

export default [
    { path: '', pathMatch: 'full', redirectTo: 'login' },
    { path: 'login', component: LoginComponent, canActivate: [guestGuard], title: 'ErgoManager - Iniciar sesión' },
    { path: 'access', component: Access, title: 'ErgoManager - Acceso denegado' },
    { path: 'error', component: Error, title: 'ErgoManager - Error' }
] as Routes;
