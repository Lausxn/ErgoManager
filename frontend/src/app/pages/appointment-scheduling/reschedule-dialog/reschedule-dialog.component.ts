import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, model, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { SkeletonModule } from 'primeng/skeleton';

import { AppointmentResponse, AvailabilityResponse } from '../../../shared/models/appointment.model';
import { ToastService } from '../../../shared/services/toast.service';
import { getApiErrorMessage } from '../../../shared/utils/api-error';
import { toLocalDateTime } from '../../../shared/utils/date-time';
import { AppointmentService } from '../appointment.service';
import { addDays, formatDuration, groupSlotsByDay, minutesBetween } from '../appointment-utils';

/** Days ahead in which the dialog offers free slots, the same window as booking. */
const RESCHEDULE_DAYS_AHEAD = 30;

/**
 * Dialog that moves a pending appointment to another free slot of the same
 * ergonomist. The old slot becomes free again.
 */
@Component({
    selector: 'app-reschedule-dialog',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [DatePipe, ButtonModule, DialogModule, SkeletonModule],
    templateUrl: './reschedule-dialog.component.html',
    // Same slot picker as the booking dialog.
    styleUrl: '../booking-dialog/booking-dialog.component.scss'
})
export class RescheduleDialogComponent {
    private readonly appointmentService = inject(AppointmentService);
    private readonly toastService = inject(ToastService);
    private readonly destroyRef = inject(DestroyRef);

    /** Whether the dialog is open, two-way bound by the agenda. */
    readonly visible = model(false);

    /** Pending appointment to move. */
    readonly appointment = input<AppointmentResponse | null>(null);

    /** Emitted with the appointment at its new time. */
    readonly rescheduled = output<AppointmentResponse>();

    private readonly slots = signal<AvailabilityResponse[]>([]);
    protected readonly isLoadingSlots = signal(false);
    protected readonly slotError = signal<string | null>(null);
    protected readonly availabilityId = signal<number | null>(null);
    protected readonly isSubmitting = signal(false);
    protected readonly errorMessage = signal<string | null>(null);
    private slotRequest?: Subscription;

    protected readonly slotDays = computed(() => groupSlotsByDay(this.slots()).map((day) => ({ ...day, slots: day.slots.map((slot) => ({ ...slot, duration: formatDuration(minutesBetween(slot.startDateTime, slot.endDateTime)) })) })));
    protected readonly selectedSlot = computed(() => this.slots().find((slot) => slot.id === this.availabilityId()) ?? null);

    /** Called when the dialog opens: starts from scratch and reads the free slots. */
    protected onShow(): void {
        this.availabilityId.set(null);
        this.errorMessage.set(null);
        this.loadSlots();
    }

    protected close(): void {
        this.visible.set(false);
    }

    protected selectSlot(slot: AvailabilityResponse): void {
        this.availabilityId.set(slot.id);
        this.errorMessage.set(null);
    }

    /** Moves the appointment to the chosen slot. */
    protected submit(): void {
        const appointment = this.appointment();
        const availabilityId = this.availabilityId();
        if (!appointment || availabilityId === null || this.isSubmitting()) {
            return;
        }
        this.isSubmitting.set(true);
        this.errorMessage.set(null);
        this.appointmentService
            .reschedule(appointment.id, { availabilityId })
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (updated) => {
                    this.isSubmitting.set(false);
                    this.toastService.success('Cita reprogramada', `${updated.employeeName}: ${formatMoment(updated.startDateTime)}`);
                    this.rescheduled.emit(updated);
                    this.close();
                },
                error: (error: unknown) => {
                    this.isSubmitting.set(false);
                    this.errorMessage.set(getApiErrorMessage(error, 'No se pudo reprogramar la cita. Intente de nuevo.'));
                    // The slot may have been booked meanwhile: offer the ones still free.
                    this.availabilityId.set(null);
                    this.loadSlots();
                }
            });
    }

    /** Reads the free slots of the ergonomist of the appointment. */
    private loadSlots(): void {
        const appointment = this.appointment();
        if (!appointment) {
            return;
        }
        const from = new Date();
        this.slotRequest?.unsubscribe();
        this.isLoadingSlots.set(true);
        this.slotError.set(null);
        this.slotRequest = this.appointmentService
            .findFreeAvailabilities(appointment.userId, toLocalDateTime(from), toLocalDateTime(addDays(from, RESCHEDULE_DAYS_AHEAD)))
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (slots) => {
                    this.slots.set(slots.filter((slot) => !slot.taken));
                    this.isLoadingSlots.set(false);
                },
                error: (error: unknown) => {
                    this.slots.set([]);
                    this.isLoadingSlots.set(false);
                    this.slotError.set(getApiErrorMessage(error, 'No se pudieron cargar los espacios libres.'));
                }
            });
    }
}

/** "lun 3 nov, 9:00", to name the new time in the confirmation. */
function formatMoment(value: string): string {
    const date = new Date(value);
    return `${date.toLocaleDateString('es', { weekday: 'short', day: 'numeric', month: 'short' })}, ${date.toLocaleTimeString('es', { hour: 'numeric', minute: '2-digit' })}`;
}
