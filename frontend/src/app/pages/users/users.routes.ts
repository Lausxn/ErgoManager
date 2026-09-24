import { Routes } from '@angular/router';

import { UserEditComponent } from './user-edit/user-edit.component';
import { UserFormComponent } from './user-form/user-form.component';
import { UserListComponent } from './user-list/user-list.component';

/** Routes of the administrator and ergonomist feature. */
export const usersRoutes: Routes = [
    { path: '', component: UserListComponent, title: 'ErgoManager - Usuarios' },
    { path: 'new', component: UserFormComponent, title: 'ErgoManager - Nuevo usuario' },
    { path: ':id', component: UserEditComponent, title: 'ErgoManager - Editar usuario' }
];
