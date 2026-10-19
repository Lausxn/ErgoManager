import { Routes } from '@angular/router';

import { unsavedChangesGuard } from '../../core/guards/unsaved-changes.guard';
import { FormDetailComponent } from './form-detail/form-detail.component';
import { FormListComponent } from './form-list/form-list.component';

/** Forms workspace and its editors; static sections precede the id route. */
export const formsRoutes: Routes = [
    { path: '', component: FormListComponent, title: 'ErgoManager - Formularios', data: { section: 'overview' } },
    { path: 'self-evaluation', component: FormListComponent, title: 'ErgoManager - Formularios de autoevaluación', data: { section: 'self-evaluation' } },
    { path: 'personalized', component: FormListComponent, title: 'ErgoManager - Formularios de evaluación personalizada', data: { section: 'personalized' } },
    { path: 'personalized/new', component: FormDetailComponent, title: 'ErgoManager - Nuevo formulario personalizado', data: { category: 'personalized' }, canDeactivate: [unsavedChangesGuard] },
    { path: 'new', component: FormDetailComponent, title: 'ErgoManager - Nuevo formulario', canDeactivate: [unsavedChangesGuard] },
    { path: ':id', component: FormDetailComponent, title: 'ErgoManager - Editar formulario', canDeactivate: [unsavedChangesGuard] }
];
