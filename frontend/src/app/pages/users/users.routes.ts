import { Routes } from '@angular/router';

import { UserEditDemoComponent } from './user-edit-demo/user-edit-demo.component';
import { UserEditComponent } from './user-edit/user-edit.component';
import { UserFormComponent } from './user-form/user-form.component';
import { UserListComponent } from './user-list/user-list.component';

/** Routes of the administrator and ergonomist feature. */
export const usersRoutes: Routes = [
    { path: '', component: UserListComponent, title: 'ErgoManager - Usuarios' },
    { path: 'new', component: UserFormComponent, title: 'ErgoManager - Nuevo usuario' },
    // DEMO TEMPORAL: eliminar junto con la carpeta user-edit-demo.
    { path: 'edit-user/testId', component: UserEditDemoComponent, title: 'ErgoManager - Editar usuario (ejemplo)' },
    { path: ':id', component: UserEditComponent, title: 'ErgoManager - Editar usuario' }
];
