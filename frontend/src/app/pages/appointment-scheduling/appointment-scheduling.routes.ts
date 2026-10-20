import { Routes } from '@angular/router';

import { roleGuard } from '../../core/guards/role.guard';
import { unsavedChangesGuard } from '../../core/guards/unsaved-changes.guard';
import { AppointmentListComponent } from './appointment-list/appointment-list.component';
import { AvailabilityFormComponent } from './availability-form/availability-form.component';

/** Routes of the appointment scheduling feature. */
export const appointmentSchedulingRoutes: Routes = [
    { path: '', component: AppointmentListComponent, title: 'ErgoManager - Agenda' },
    {
        path: 'availabilities',
        canActivate: [roleGuard(['ERGONOMIST', 'ADMIN'])],
        canDeactivate: [unsavedChangesGuard],
        component: AvailabilityFormComponent,
        title: 'ErgoManager - Gestionar disponibilidad'
    },
    // Former address of the single slot form, kept so old links still work.
    { path: 'availabilities/new', redirectTo: 'availabilities' }
];
