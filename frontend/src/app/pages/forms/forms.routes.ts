import { Routes } from '@angular/router';

import { unsavedChangesGuard } from '../../core/guards/unsaved-changes.guard';
import { HubOption, OptionHubComponent } from '../../shared/components/option-hub/option-hub.component';
import { FormDetailComponent } from './form-detail/form-detail.component';
import { FormListComponent } from './form-list/form-list.component';

/** The two kinds of forms, each with its own list. */
export const FORMS_OPTIONS: readonly HubOption[] = [
    { title: 'Autoevaluaciones', description: 'Formularios que responden los colaboradores.', icon: 'fa-solid fa-list-check', route: '/forms/self-evaluation' },
    { title: 'Evaluaciones personalizadas', description: 'Formularios que aplica el ergonomista en la cita.', icon: 'fa-solid fa-user-check', route: '/forms/personalized' }
];

/** Forms workspace and its editors; static sections precede the id route. */
export const formsRoutes: Routes = [
    { path: '', component: OptionHubComponent, title: 'ErgoManager - Formularios', data: { heading: 'Formularios', options: FORMS_OPTIONS } },
    { path: 'self-evaluation', component: FormListComponent, title: 'ErgoManager - Formularios de autoevaluación', data: { section: 'self-evaluation' } },
    { path: 'personalized', component: FormListComponent, title: 'ErgoManager - Formularios de evaluación personalizada', data: { section: 'personalized' } },
    { path: 'personalized/new', component: FormDetailComponent, title: 'ErgoManager - Nuevo formulario personalizado', data: { category: 'personalized' }, canDeactivate: [unsavedChangesGuard] },
    { path: 'new', component: FormDetailComponent, title: 'ErgoManager - Nuevo formulario', canDeactivate: [unsavedChangesGuard] },
    { path: ':id', component: FormDetailComponent, title: 'ErgoManager - Editar formulario', canDeactivate: [unsavedChangesGuard] }
];
