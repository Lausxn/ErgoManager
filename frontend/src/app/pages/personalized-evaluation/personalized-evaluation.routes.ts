import { Routes } from '@angular/router';

import { unsavedChangesGuard } from '../../core/guards/unsaved-changes.guard';
import { PersonalizedEvaluationFormComponent } from './personalized-evaluation-form/personalized-evaluation-form.component';

/** Routes of the personalized evaluation feature. */
export const personalizedEvaluationRoutes: Routes = [{ path: '', component: PersonalizedEvaluationFormComponent, title: 'ErgoManager - Evaluación personalizada', canDeactivate: [unsavedChangesGuard] }];
