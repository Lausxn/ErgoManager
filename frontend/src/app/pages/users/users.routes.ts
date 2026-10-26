import { Routes } from '@angular/router';

import { unsavedChangesGuard } from '../../core/guards/unsaved-changes.guard';
import { DeactivateUserConfirmationComponent } from './deactivate-user-confirmation/deactivate-user-confirmation.component';
import { UserEditComponent } from './user-edit/user-edit.component';
import { UserFormComponent } from './user-form/user-form.component';
import { UserListComponent } from './user-list/user-list.component';

/** Routes of the administrator and ergonomist feature. */
export const usersRoutes: Routes = [
    { path: '', component: UserListComponent, title: 'ErgoManager - Usuarios' },
    { path: 'deactivate-confirmation', component: DeactivateUserConfirmationComponent, title: 'ErgoManager - Desactivar usuario' },
    { path: 'new', component: UserFormComponent, title: 'ErgoManager - Nuevo usuario', canDeactivate: [unsavedChangesGuard] },
    { path: ':id', component: UserEditComponent, title: 'ErgoManager - Editar usuario', canDeactivate: [unsavedChangesGuard] }
];
