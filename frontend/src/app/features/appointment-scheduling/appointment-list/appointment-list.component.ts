import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { AppointmentResponse } from '../../../shared/models/appointment.model';
import { AuthService } from '../../../core/services/auth.service';
import { AppointmentService } from '../appointment.service';

const DAYS_SHOWN_AHEAD = 30;

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Agenda of the signed in ergonomist for the coming weeks.
 */
@Component({
  selector: 'app-appointment-list',
  imports: [RouterLink],
  templateUrl: './appointment-list.component.html',
  styleUrl: './appointment-list.component.css',
})
export class AppointmentListComponent {
  private readonly appointmentService = inject(AppointmentService);

  private readonly authService = inject(AuthService);

  protected readonly appointmentList = signal<AppointmentResponse[]>([]);

  constructor() {
    this.loadAgenda();
  }

  /**
   * Reads the appointments of the signed in ergonomist.
   */
  protected loadAgenda(): void {
    const userId = this.authService.session()?.userId;
    if (userId === undefined) {
      return;
    }

    const from = new Date();
    const to = new Date(from.getTime() + DAYS_SHOWN_AHEAD * MILLISECONDS_PER_DAY);

    this.appointmentService
      .findAgenda(userId, from.toISOString(), to.toISOString())
      .subscribe((appointmentList) => this.appointmentList.set(appointmentList));
  }

  /**
   * Cancels an appointment and refreshes the agenda.
   *
   * @param id identifier of the appointment
   */
  protected cancel(id: number): void {
    this.appointmentService.cancel(id).subscribe(() => this.loadAgenda());
  }
}
