import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';

import { AuthService } from '../../../core/services/auth.service';
import { AvailabilityRequest } from '../../../shared/models/appointment.model';
import { AppointmentService } from '../appointment.service';

/**
 * Form where an ergonomist publishes a time slot that employees can book.
 */
@Component({
  selector: 'app-availability-form',
  imports: [ReactiveFormsModule],
  templateUrl: './availability-form.component.html',
  styleUrl: './availability-form.component.css',
})
export class AvailabilityFormComponent {
  private readonly formBuilder = inject(FormBuilder);

  private readonly appointmentService = inject(AppointmentService);

  private readonly authService = inject(AuthService);

  private readonly router = inject(Router);

  protected readonly availabilityForm = this.formBuilder.nonNullable.group({
    startDateTime: ['', [Validators.required]],
    endDateTime: ['', [Validators.required]],
  });

  protected readonly isSubmitting = signal(false);

  /**
   * Publishes the slot for the signed in ergonomist.
   */
  protected submit(): void {
    const userId = this.authService.session()?.userId;
    if (this.availabilityForm.invalid || userId === undefined) {
      this.availabilityForm.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    const request: AvailabilityRequest = { userId, ...this.availabilityForm.getRawValue() };

    this.appointmentService.createAvailability(request).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        void this.router.navigate(['/appointments']);
      },
      error: () => this.isSubmitting.set(false),
    });
  }
}
