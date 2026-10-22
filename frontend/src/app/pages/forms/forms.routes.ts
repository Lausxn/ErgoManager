import { Routes } from '@angular/router';

import { unsavedChangesGuard } from '../../core/guards/unsaved-changes.guard';
import { FormDetailComponent } from './form-detail/form-detail.component';
import { FormListComponent } from './form-list/form-list.component';

/** Routes of the self evaluation form feature. */
export const formsRoutes: Routes = [
    { path: '', component: FormListComponent, title: 'ErgoManager - Formularios' },
    { path: 'new', component: FormDetailComponent, title: 'ErgoManager - Nuevo formulario', canDeactivate: [unsavedChangesGuard] },
    { path: ':id', component: FormDetailComponent, title: 'ErgoManager - Editar formulario', canDeactivate: [unsavedChangesGuard] }
];
