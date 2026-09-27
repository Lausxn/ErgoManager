import { Routes } from '@angular/router';

import { UserFormComponent } from './user-form/user-form.component';
import { UserListComponent } from './user-list/user-list.component';
import { DeactivateUserConfirmationComponent } from './deactivate-user-confirmation/deactivate-user-confirmation.component';

/** Routes of the administrator and ergonomist feature. */
export const usersRoutes: Routes = [
    { path: '', component: UserListComponent, title: 'ErgoManager - Usuarios' },
    { path: 'new', component: UserFormComponent, title: 'ErgoManager - Nuevo usuario' },
    { path: 'deactivate-confirmation', component: DeactivateUserConfirmationComponent, title: 'ErgoManager - Desactivar usuario' },
    { path: ':id', component: UserFormComponent, title: 'ErgoManager - Editar usuario' }
];
