import { Routes } from '@angular/router';

import {
  PersonalizedEvaluationFormComponent,
} from './personalized-evaluation-form/personalized-evaluation-form.component';

/** Routes of the personalized evaluation feature. */
export const personalizedEvaluationRoutes: Routes = [
  {
    path: '',
    component: PersonalizedEvaluationFormComponent,
    title: 'ErgoManager - Personalized evaluation',
  },
];
