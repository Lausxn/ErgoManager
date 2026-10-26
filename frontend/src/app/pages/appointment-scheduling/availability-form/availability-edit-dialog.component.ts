import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, input, model, output, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DatePickerModule } from 'primeng/datepicker';
import { DialogModule } from 'primeng/dialog';

import { FormFieldComponent } from '../../../shared/components/form-field/form-field.component';
import { AppointmentResponse, AvailabilityResponse } from '../../../shared/models/appointment.model';
import { ToastService } from '../../../shared/services/toast.service';
import { toLocalDateTime } from '../../../shared/utils/date-time';
import { markFormAsDirty } from '../../../shared/utils/form';
import { AppointmentService } from '../appointment.service';
import { combineDayAndTime, rangesOverlap, timeOfDay } from '../appointment-utils';
import { OVERLAP_MESSAGE, failureReason, formatTimes, startOfToday, validateRange } from './availability-planning';

/**
 * Dialog that changes the day and hours of a free slot. It stays open while
 * `slot` holds a value; the page reads the calendar again when `failed` fires,
 * since the slot may have been booked, or another one published, meanwhile.
 */
@Component({
    selector: 'app-availability-edit-dialog',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [ReactiveFormsModule, ButtonModule, DatePickerModule, DialogModule, FormFieldComponent],
    templateUrl: './availability-edit-dialog.component.html',
    styleUrl: './availability-edit-dialog.component.scss'
})
export class AvailabilityEditDialogComponent {
    private readonly formBuilder = inject(FormBuilder);
    private readonly appointmentService = inject(AppointmentService);
    private readonly toastService = inject(ToastService);
    private readonly destroyRef = inject(DestroyRef);

    /** Free slot being changed; null closes the dialog. */
    readonly slot = model<AvailabilityResponse | null>(null);
    /** Free slots of the agenda, the edited one included. */
    readonly freeSlots = input.required<readonly AvailabilityResponse[]>();
    /** Booked appointments of the agenda. */
    readonly bookedAppointments = input.required<readonly AppointmentResponse[]>();
    readonly saved = output<AvailabilityResponse>();
    readonly failed = output<void>();

    protected readonly today = startOfToday();
    protected readonly isSaving = signal(false);
    protected readonly error = signal<string | null>(null);
    protected readonly form = this.formBuilder.group(
        {
            date: this.formBuilder.control<Date | null>(null, [Validators.required]),
            startTime: this.formBuilder.control<Date | null>(null, [Validators.required]),
            endTime: this.formBuilder.control<Date | null>(null, [Validators.required])
        },
        { validators: validateRange }
    );

    constructor() {
        // Loads the day and hours of each slot the page opens.
        effect(() => {
            const slot = this.slot();
            if (slot !== null) {
                untracked(() => this.load(slot));
            }
        });
    }

    protected close(): void {
        this.slot.set(null);
    }

    /** Tells whether the dialog has to show its "end after start" message. */
    protected isRangeInvalid(): boolean {
        return this.form.hasError('invalidRange') && (this.form.dirty || this.form.touched);
    }

    /**
     * Saves the new day and hours of the slot. The same checks as the preview
     * run first, so a slot that already passed or overlaps another one is not
     * sent; the backend checks them again.
     */
    protected save(): void {
        const slot = this.slot();
        if (slot === null || this.isSaving()) {
            return;
        }
        if (this.form.invalid) {
            markFormAsDirty(this.form);
            this.error.set('Revise el día y las horas del espacio.');
            return;
        }
        const { date, startTime, endTime } = this.form.getRawValue();
        const start = combineDayAndTime(date, startTime)!;
        const end = combineDayAndTime(date, endTime)!;
        if (start.getTime() <= Date.now()) {
            this.error.set('El nuevo horario ya pasó. Elija una hora futura.');
            return;
        }
        const others = [...this.freeSlots().filter((other) => other.id !== slot.id), ...this.bookedAppointments()];
        if (others.some((other) => rangesOverlap(start, end, new Date(other.startDateTime), new Date(other.endDateTime)))) {
            this.error.set(OVERLAP_MESSAGE);
            return;
        }

        this.error.set(null);
        this.isSaving.set(true);
        this.appointmentService
            .updateAvailability(slot.id, { userId: slot.userId, startDateTime: toLocalDateTime(start), endDateTime: toLocalDateTime(end) })
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (updated) => {
                    this.isSaving.set(false);
                    this.toastService.success('Espacio actualizado', formatTimes(updated.startDateTime, updated.endDateTime));
                    this.saved.emit(updated);
                    this.close();
                },
                error: (error: unknown) => {
                    this.isSaving.set(false);
                    this.error.set(failureReason(error));
                    this.failed.emit();
                }
            });
    }

    private load(slot: AvailabilityResponse): void {
        const start = new Date(slot.startDateTime);
        const end = new Date(slot.endDateTime);
        const day = new Date(start);
        day.setHours(0, 0, 0, 0);
        this.form.reset({ date: day, startTime: timeOfDay(start.getHours(), start.getMinutes()), endTime: timeOfDay(end.getHours(), end.getMinutes()) });
        this.error.set(null);
    }
}
