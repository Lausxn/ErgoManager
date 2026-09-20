import { Routes } from '@angular/router';

import { CompanyFormComponent } from './company-form/company-form.component';
import { CompanyListComponent } from './company-list/company-list.component';

/** Routes of the client company feature. */
export const companiesRoutes: Routes = [
  {
    path: '',
    component: CompanyListComponent,
    title: 'ErgoManager - Companies',
  },
  {
    path: 'new',
    component: CompanyFormComponent,
    title: 'ErgoManager - New company',
  },
  {
    path: ':id',
    component: CompanyFormComponent,
    title: 'ErgoManager - Edit company',
  },
];
