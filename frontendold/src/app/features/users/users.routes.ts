import { Routes } from '@angular/router';

import { UserFormComponent } from './user-form/user-form.component';
import { UserListComponent } from './user-list/user-list.component';

/** Routes of the administrator and ergonomist feature. */
export const usersRoutes: Routes = [
  {
    path: '',
    component: UserListComponent,
    title: 'ErgoManager - Users',
  },
  {
    path: 'new',
    component: UserFormComponent,
    title: 'ErgoManager - New user',
  },
  {
    path: ':id',
    component: UserFormComponent,
    title: 'ErgoManager - Edit user',
  },
];
