import { Routes } from '@angular/router';

import { roleGuard } from '../../core/guards/role.guard';
import { unsavedChangesGuard } from '../../core/guards/unsaved-changes.guard';
import { HubOption, OptionHubComponent } from '../../shared/components/option-hub/option-hub.component';
import { AppointmentListComponent } from './appointment-list/appointment-list.component';
import { AvailabilityFormComponent } from './availability-form/availability-form.component';

/** The two screens of the appointments section. */
export const APPOINTMENTS_OPTIONS: readonly HubOption[] = [
    { title: 'Agenda', description: 'Consulte, agende y reprograme las citas.', icon: 'fa-regular fa-calendar-days', route: '/appointments/agenda' },
    { title: 'Disponibilidad', description: 'Publique y edite los espacios para agendar citas.', icon: 'fa-regular fa-calendar-plus', route: '/appointments/availabilities' }
];

/** Routes of the appointment scheduling feature. */
export const appointmentSchedulingRoutes: Routes = [
    { path: '', component: OptionHubComponent, title: 'ErgoManager - Citas', data: { heading: 'Citas', options: APPOINTMENTS_OPTIONS } },
    { path: 'agenda', component: AppointmentListComponent, title: 'ErgoManager - Agenda' },
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
