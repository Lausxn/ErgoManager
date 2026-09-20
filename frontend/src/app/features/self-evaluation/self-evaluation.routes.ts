import { Routes } from '@angular/router';

import { SelfEvaluationFormComponent } from './self-evaluation-form/self-evaluation-form.component';

/** Routes of the self evaluation feature, open to the employees. */
export const selfEvaluationRoutes: Routes = [
  {
    path: '',
    component: SelfEvaluationFormComponent,
    title: 'ErgoManager - Self evaluation',
  },
];
