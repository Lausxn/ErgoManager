import { Routes } from '@angular/router';

import { unsavedChangesGuard } from '../../core/guards/unsaved-changes.guard';
import { UserFormComponent } from './user-form/user-form.component';
import { UserListComponent } from './user-list/user-list.component';

/** Routes of the administrator and ergonomist feature. */
export const usersRoutes: Routes = [
    { path: '', component: UserListComponent, title: 'ErgoManager - Usuarios' },
    { path: 'new', component: UserFormComponent, title: 'ErgoManager - Nuevo usuario', canDeactivate: [unsavedChangesGuard] },
    { path: ':id', component: UserFormComponent, title: 'ErgoManager - Editar usuario', canDeactivate: [unsavedChangesGuard] }
];
