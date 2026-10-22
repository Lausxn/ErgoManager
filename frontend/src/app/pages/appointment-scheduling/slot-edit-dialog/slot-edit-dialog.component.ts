import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, input, model, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Subscription } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { DatePickerModule } from 'primeng/datepicker';
import { DialogModule } from 'primeng/dialog';
import { SkeletonModule } from 'primeng/skeleton';

import { FormFieldComponent } from '../../../shared/components/form-field/form-field.component';
import { AvailabilityResponse } from '../../../shared/models/appointment.model';
import { ToastService } from '../../../shared/services/toast.service';
import { getApiErrorMessage } from '../../../shared/utils/api-error';
import { toLocalDateTime } from '../../../shared/utils/date-time';
import { markFormAsDirty } from '../../../shared/utils/form';
import { AppointmentService } from '../appointment.service';
import { combineDayAndTime, formatDuration } from '../appointment-utils';

/** Checks that the slot ends after it starts. */
function validateTimes(group: AbstractControl): ValidationErrors | null {
    const start = group.get('startTime')?.value as Date | null;
    const end = group.get('endTime')?.value as Date | null;
    if (!start || !end) {
        return null;
    }
    return end.getHours() * 60 + end.getMinutes() <= start.getHours() * 60 + start.getMinutes() ? { invalidRange: true } : null;
}

/**
 * Dialog that changes the date and time of a free slot. It reads the slot
 * again when it opens, because it may have been booked or removed since the
 * calendar was loaded.
 */
@Component({
    selector: 'app-slot-edit-dialog',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [ReactiveFormsModule, ButtonModule, DatePickerModule, DialogModule, SkeletonModule, FormFieldComponent],
    templateUrl: './slot-edit-dialog.component.html'
})
export class SlotEditDialogComponent {
    private readonly formBuilder = inject(FormBuilder);
    private readonly appointmentService = inject(AppointmentService);
    private readonly toastService = inject(ToastService);
    private readonly destroyRef = inject(DestroyRef);

    /** Whether the dialog is open, two-way bound by the page. */
    readonly visible = model(false);

    /** Free slot to edit. */
    readonly slot = input<AvailabilityResponse | null>(null);

    /** Emitted with the slot after its new time was saved. */
    readonly saved = output<AvailabilityResponse>();

    /** Emitted when the slot was booked or removed meanwhile, so the page reads it again. */
    readonly outdated = output<void>();

    /** Start of today: earlier days cannot be chosen. */
    protected readonly today = startOfToday();
    protected readonly isLoading = signal(false);
    protected readonly isSubmitting = signal(false);
    protected readonly errorMessage = signal<string | null>(null);

    protected readonly slotForm = this.formBuilder.group(
        {
            day: this.formBuilder.control<Date | null>(null, [Validators.required]),
            startTime: this.formBuilder.control<Date | null>(null, [Validators.required]),
            endTime: this.formBuilder.control<Date | null>(null, [Validators.required])
        },
        { validators: validateTimes }
    );

    private loadRequest?: Subscription;

    /** Called when the dialog opens: reads the current state of the slot. */
    protected onShow(): void {
        const slot = this.slot();
        if (!slot) {
            return;
        }
        this.errorMessage.set(null);
        this.isLoading.set(true);
        this.loadRequest?.unsubscribe();
        this.loadRequest = this.appointmentService
            .findAvailabilityById(slot.id)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (current) => {
                    this.isLoading.set(false);
                    if (current.taken) {
                        this.giveUp('El espacio ya fue reservado', 'Para cambiar su horario, reprograme la cita desde la agenda.');
                        return;
                    }
                    const start = new Date(current.startDateTime);
                    this.slotForm.reset({ day: start, startTime: start, endTime: new Date(current.endDateTime) });
                },
                error: (error: unknown) => {
                    this.isLoading.set(false);
                    if (error instanceof HttpErrorResponse && error.status === 404) {
                        this.giveUp('El espacio ya no existe', 'Se eliminó mientras tanto.');
                        return;
                    }
                    this.errorMessage.set(getApiErrorMessage(error, 'No se pudo leer el espacio. Intente de nuevo.'));
                }
            });
    }

    protected close(): void {
        this.visible.set(false);
    }

    /** Length of the slot as typed, for the summary under the fields. */
    protected duration(): string {
        const { startTime, endTime } = this.slotForm.getRawValue();
        if (!startTime || !endTime || this.slotForm.hasError('invalidRange')) {
            return '';
        }
        return formatDuration(endTime.getHours() * 60 + endTime.getMinutes() - (startTime.getHours() * 60 + startTime.getMinutes()));
    }

    /** Sends the new date and time, keeping the dialog open when the backend rejects them. */
    protected submit(): void {
        const slot = this.slot();
        if (!slot || this.isSubmitting() || this.isLoading()) {
            return;
        }
        const { day, startTime, endTime } = this.slotForm.getRawValue();
        const start = combineDayAndTime(day, startTime);
        const end = combineDayAndTime(day, endTime);
        if (this.slotForm.invalid || !start || !end) {
            markFormAsDirty(this.slotForm);
            this.errorMessage.set(this.slotForm.hasError('invalidRange') ? 'La hora final debe ser posterior a la inicial.' : 'Complete la fecha y las horas.');
            return;
        }
        if (start.getTime() <= Date.now()) {
            this.errorMessage.set('Elija una hora que todavía no haya pasado.');
            return;
        }

        this.errorMessage.set(null);
        this.isSubmitting.set(true);
        this.appointmentService
            .updateAvailability(slot.id, { userId: slot.userId, startDateTime: toLocalDateTime(start), endDateTime: toLocalDateTime(end) })
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (updated) => {
                    this.isSubmitting.set(false);
                    this.toastService.success('Horario actualizado', 'El espacio sigue disponible para agendar citas.');
                    this.saved.emit(updated);
                    this.close();
                },
                error: (error: unknown) => {
                    this.isSubmitting.set(false);
                    if (error instanceof HttpErrorResponse && error.status === 404) {
                        this.giveUp('El espacio ya no existe', 'Se eliminó mientras tanto.');
                        return;
                    }
                    // An overlap (409) or a slot booked meanwhile (400) explain themselves.
                    this.errorMessage.set(getApiErrorMessage(error, 'No se pudo guardar el horario. Intente de nuevo.'));
                }
            });
    }

    /** Closes the dialog because the slot cannot be edited any more, and asks the page to read it again. */
    private giveUp(title: string, detail: string): void {
        this.toastService.warning(title, detail);
        this.outdated.emit();
        this.close();
    }
}

function startOfToday(): Date {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
}
