import { Routes } from '@angular/router';

import { AppointmentListComponent } from './appointment-list/appointment-list.component';
import { AvailabilityFormComponent } from './availability-form/availability-form.component';

/** Routes of the appointment scheduling feature. */
export const appointmentSchedulingRoutes: Routes = [
  {
    path: '',
    component: AppointmentListComponent,
    title: 'ErgoManager - Agenda',
  },
  {
    path: 'availabilities/new',
    component: AvailabilityFormComponent,
    title: 'ErgoManager - New availability',
  },
];
