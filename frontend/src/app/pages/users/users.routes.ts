import { Routes } from '@angular/router';

import { unsavedChangesGuard } from '../../core/guards/unsaved-changes.guard';
import { UserEditComponent } from './user-edit/user-edit.component';
import { DEMO_USER_ID, DemoUserService } from './user-edit/user-edit.demo';
import { UserService } from './user.service';
import { UserFormComponent } from './user-form/user-form.component';
import { UserListComponent } from './user-list/user-list.component';

/** Routes of the administrator and ergonomist feature. */
export const usersRoutes: Routes = [
    { path: '', component: UserListComponent, title: 'ErgoManager - Usuarios' },
    { path: 'new', component: UserFormComponent, title: 'ErgoManager - Nuevo usuario' },
    // TEMPORARY: edit page with sample data, remove together with user-edit.demo.ts.
    {
        path: 'user-edit/testUserId',
        component: UserEditComponent,
        title: 'ErgoManager - Editar usuario (ejemplo)',
        data: { id: DEMO_USER_ID },
        canDeactivate: [unsavedChangesGuard],
        providers: [{ provide: UserService, useClass: DemoUserService }]
    },
    { path: ':id', component: UserEditComponent, title: 'ErgoManager - Editar usuario', canDeactivate: [unsavedChangesGuard] }
];
