import { Routes } from '@angular/router';

import { FormDetailComponent } from './form-detail/form-detail.component';
import { FormListComponent } from './form-list/form-list.component';

/** Routes of the self evaluation form feature. */
export const formsRoutes: Routes = [
  {
    path: '',
    component: FormListComponent,
    title: 'ErgoManager - Forms',
  },
  {
    path: 'new',
    component: FormDetailComponent,
    title: 'ErgoManager - New form',
  },
  {
    path: ':id',
    component: FormDetailComponent,
    title: 'ErgoManager - Edit form',
  },
];
