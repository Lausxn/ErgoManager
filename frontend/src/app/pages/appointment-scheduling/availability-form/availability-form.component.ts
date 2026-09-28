import { Component, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DatePickerModule } from 'primeng/datepicker';

import { AuthService } from '../../../core/services/auth.service';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { AvailabilityRequest } from '../../../shared/models/appointment.model';
import { toLocalDateTime } from '../../../shared/utils/date-time';
import { isControlInvalid, markFormAsDirty } from '../../../shared/utils/form';
import { AppointmentService } from '../appointment.service';

/**
 * Checks that the slot ends after it starts.
 *
 * @param group group holding the start and the end of the slot
 * @returns the error, or null when the range is valid
 */
function validateRange(group: AbstractControl): ValidationErrors | null {
    const start = group.get('startDateTime')?.value as Date | null;
    const end = group.get('endDateTime')?.value as Date | null;
    return start && end && end <= start ? { invalidRange: true } : null;
}

/**
 * Form where an ergonomist publishes a time slot that employees can book.
 */
@Component({
    selector: 'app-availability-form',
    standalone: true,
    imports: [ReactiveFormsModule, RouterLink, ButtonModule, DatePickerModule, PageHeaderComponent],
    templateUrl: './availability-form.component.html'
})
export class AvailabilityFormComponent {
    private readonly formBuilder = inject(FormBuilder);

    private readonly appointmentService = inject(AppointmentService);

    private readonly authService = inject(AuthService);

    private readonly messageService = inject(MessageService);

    private readonly router = inject(Router);

    protected readonly today = new Date();

    protected readonly availabilityForm = this.formBuilder.group(
        {
            startDateTime: this.formBuilder.control<Date | null>(null, [Validators.required]),
            endDateTime: this.formBuilder.control<Date | null>(null, [Validators.required])
        },
        { validators: validateRange }
    );

    protected readonly isSubmitting = signal(false);

    /**
     * Checks whether a field has to show its error message.
     *
     * @param field name of the control
     * @returns true when the value is invalid and the user worked on it
     */
    protected isInvalid(field: string): boolean {
        return isControlInvalid(this.availabilityForm.get(field));
    }

    /**
     * Publishes the slot for the signed in ergonomist.
     */
    protected submit(): void {
        const userId = this.authService.session()?.userId;
        const { startDateTime, endDateTime } = this.availabilityForm.getRawValue();
        if (this.availabilityForm.invalid || userId === undefined || !startDateTime || !endDateTime) {
            markFormAsDirty(this.availabilityForm);
            return;
        }

        this.isSubmitting.set(true);
        const request: AvailabilityRequest = { userId, startDateTime: toLocalDateTime(startDateTime), endDateTime: toLocalDateTime(endDateTime) };

        this.appointmentService.createAvailability(request).subscribe({
            next: () => {
                this.isSubmitting.set(false);
                this.messageService.add({ severity: 'success', summary: 'Disponibilidad publicada', detail: 'Los colaboradores ya pueden reservar este espacio.' });
                void this.router.navigate(['/appointments']);
            },
            error: () => {
                this.isSubmitting.set(false);
                this.messageService.add({ severity: 'error', summary: 'No se pudo publicar', detail: 'Revise el horario e intente de nuevo.' });
            }
        });
    }
}
