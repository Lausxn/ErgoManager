import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, input, numberAttribute, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { AvatarModule } from 'primeng/avatar';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { SelectButtonModule } from 'primeng/selectbutton';
import { SkeletonModule } from 'primeng/skeleton';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';

import { AuthService } from '../../../core/services/auth.service';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { StatCardComponent } from '../../../shared/components/stat-card/stat-card.component';
import { AppointmentResponse, AvailabilityResponse } from '../../../shared/models/appointment.model';
import { UserResponse } from '../../../shared/models/user.model';
import { DialogService } from '../../../shared/services/dialog.service';
import { ToastService } from '../../../shared/services/toast.service';
import { getApiErrorMessage } from '../../../shared/utils/api-error';
import { toLocalDateTime } from '../../../shared/utils/date-time';
import { APPOINTMENT_STATUS_LABELS, APPOINTMENT_STATUS_TAG_CLASSES } from '../../../shared/utils/labels';
import { UserService } from '../../users/user.service';
import { AppointmentService } from '../appointment.service';
import { addDays, formatDuration, groupSlotsByDay, isPendingStatus, minutesBetween } from '../appointment-utils';
import { BookingDialogComponent } from '../booking-dialog/booking-dialog.component';

/** Placeholder rows drawn as skeletons while the agenda loads. */
const SKELETON_ROWS = Array.from({ length: 5 }, (_, index) => ({ id: -index - 1 }));

type Period = 'NEXT_7' | 'NEXT_30' | 'LAST_30';

/** Days covered by each period, negative when it looks back. */
const PERIOD_DAYS: Record<Period, number> = { NEXT_7: 7, NEXT_30: 30, LAST_30: -30 };

/** Ergonomist offered in the selector of the administrator. */
interface ErgonomistOption {
    id: number;
    fullName: string;
    email: string;
}

/** Appointment with the values the table shows, computed once per load. */
interface AppointmentRow extends AppointmentResponse {
    initials: string;
    statusLabel: string;
    statusTagClass: string;
    isPending: boolean;
    canEvaluate: boolean;
}

/**
 * Agenda of an ergonomist: appointments of a period, free slots and the
 * booking of new appointments. The administrator chooses the ergonomist.
 */
@Component({
    selector: 'app-appointment-list',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [DatePipe, FormsModule, RouterLink, AvatarModule, ButtonModule, SelectModule, SelectButtonModule, SkeletonModule, TableModule, TagModule, TooltipModule, BookingDialogComponent, EmptyStateComponent, PageHeaderComponent, StatCardComponent],
    templateUrl: './appointment-list.component.html',
    styleUrl: './appointment-list.component.scss'
})
export class AppointmentListComponent implements OnInit {
    private readonly appointmentService = inject(AppointmentService);

    private readonly userService = inject(UserService);

    private readonly authService = inject(AuthService);

    private readonly dialogService = inject(DialogService);

    private readonly toastService = inject(ToastService);

    private readonly router = inject(Router);

    private readonly destroyRef = inject(DestroyRef);

    /** Ergonomist to show first, from the ?userId= query parameter (administrator only). */
    readonly userId = input<number | undefined, unknown>(undefined, { transform: numberAttribute });

    protected readonly isAdmin = computed(() => this.authService.session()?.role === 'ADMIN');

    protected readonly periodOptions: { label: string; value: Period }[] = [
        { label: 'Próximos 7 días', value: 'NEXT_7' },
        { label: 'Próximos 30 días', value: 'NEXT_30' },
        { label: 'Últimos 30 días', value: 'LAST_30' }
    ];

    protected readonly skeletonRows = SKELETON_ROWS;

    protected readonly period = signal<Period>('NEXT_7');

    protected readonly ergonomists = signal<ErgonomistOption[]>([]);

    protected readonly isLoadingErgonomists = signal(false);

    protected readonly ergonomistError = signal<string | null>(null);

    protected readonly selectedErgonomistId = signal<number | null>(null);

    private readonly appointments = signal<AppointmentResponse[]>([]);

    protected readonly isLoading = signal(true);

    protected readonly loadError = signal<string | null>(null);

    private readonly slots = signal<AvailabilityResponse[]>([]);

    protected readonly isLoadingSlots = signal(true);

    protected readonly slotError = signal<string | null>(null);

    /** False when the period is in the past, where there are no free slots to offer. */
    protected readonly periodHasFuture = computed(() => PERIOD_DAYS[this.period()] > 0);

    protected readonly deletingSlotId = signal<number | null>(null);

    protected readonly cancellingId = signal<number | null>(null);

    protected readonly isBookingOpen = signal(false);

    /** Range of the last load, used to decide whether a booked appointment belongs to it. */
    private range = { from: new Date(), to: new Date() };

    private agendaRequest?: Subscription;

    private slotRequest?: Subscription;

    protected readonly selectedErgonomistName = computed(() => {
        if (!this.isAdmin()) {
            return this.authService.session()?.fullName ?? '';
        }
        return this.ergonomists().find((ergonomist) => ergonomist.id === this.selectedErgonomistId())?.fullName ?? '';
    });

    protected readonly rows = computed<AppointmentRow[]>(() => {
        const isErgonomist = !this.isAdmin();
        return this.appointments().map((appointment) => {
            const isPending = isPendingStatus(appointment.status);
            const [first = '', second = ''] = appointment.employeeName.trim().split(/\s+/);
            return {
                ...appointment,
                initials: `${first.charAt(0)}${second.charAt(0)}`.toUpperCase(),
                statusLabel: APPOINTMENT_STATUS_LABELS[appointment.status],
                statusTagClass: APPOINTMENT_STATUS_TAG_CLASSES[appointment.status],
                isPending,
                canEvaluate: isErgonomist && isPending && !appointment.evaluated
            };
        });
    });

    /** Figures of the summary cards, counted in a single pass. */
    protected readonly summary = computed(() => {
        const summary = { total: 0, pending: 0, completed: 0 };
        for (const appointment of this.appointments()) {
            summary.total++;
            if (isPendingStatus(appointment.status)) {
                summary.pending++;
            } else if (appointment.status === 'COMPLETED') {
                summary.completed++;
            }
        }
        return summary;
    });

    protected readonly slotCount = computed(() => this.slots().length);

    protected readonly slotDays = computed(() =>
        groupSlotsByDay(this.slots()).map((day) => ({ ...day, slots: day.slots.map((slot) => ({ ...slot, duration: formatDuration(minutesBetween(slot.startDateTime, slot.endDateTime)) })) }))
    );

    /** Self evaluations that already hold a pending appointment, so the dialog can warn about them. */
    protected readonly pendingSelfEvaluationIds = computed<ReadonlySet<number>>(() => new Set(this.appointments().filter((appointment) => isPendingStatus(appointment.status)).map((appointment) => appointment.selfEvaluationId)));

    ngOnInit(): void {
        if (this.isAdmin()) {
            this.loadErgonomists();
            return;
        }
        this.selectedErgonomistId.set(this.authService.session()?.userId ?? null);
        this.reload();
    }

    /** Reads the active ergonomists the administrator can choose from. */
    protected loadErgonomists(): void {
        this.isLoadingErgonomists.set(true);
        this.ergonomistError.set(null);
        this.userService
            .findAll()
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (users) => {
                    const ergonomists = users
                        .filter((user) => user.active && user.role === 'ERGONOMIST')
                        .map((user) => ({ id: user.id, fullName: fullNameOf(user), email: user.email }))
                        .sort((a, b) => a.fullName.localeCompare(b.fullName));
                    this.ergonomists.set(ergonomists);
                    this.isLoadingErgonomists.set(false);
                    const requested = this.userId();
                    const preselected = ergonomists.find((ergonomist) => ergonomist.id === requested) ?? ergonomists[0];
                    if (preselected) {
                        this.selectedErgonomistId.set(preselected.id);
                        this.reload();
                    }
                },
                error: (error: unknown) => {
                    this.isLoadingErgonomists.set(false);
                    this.ergonomistError.set(getApiErrorMessage(error, 'No se pudieron cargar los ergonomistas.'));
                }
            });
    }

    protected selectErgonomist(id: number | null): void {
        if (id === null || id === this.selectedErgonomistId()) {
            return;
        }
        this.selectedErgonomistId.set(id);
        this.reload();
    }

    protected selectPeriod(period: Period | null): void {
        if (period === null || period === this.period()) {
            return;
        }
        this.period.set(period);
        this.reload();
    }

    /** Reads the appointments and the free slots of the selected ergonomist in the selected period. */
    protected reload(): void {
        const userId = this.selectedErgonomistId();
        if (userId === null) {
            return;
        }
        const now = new Date();
        const days = PERIOD_DAYS[this.period()];
        this.range = days > 0 ? { from: now, to: addDays(now, days) } : { from: addDays(now, days), to: now };

        this.agendaRequest?.unsubscribe();
        this.isLoading.set(true);
        this.loadError.set(null);
        this.agendaRequest = this.appointmentService
            .findAgenda(userId, toLocalDateTime(this.range.from), toLocalDateTime(this.range.to))
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (appointments) => {
                    this.appointments.set(appointments);
                    this.isLoading.set(false);
                },
                error: (error: unknown) => {
                    this.appointments.set([]);
                    this.isLoading.set(false);
                    this.loadError.set(getApiErrorMessage(error, 'No se pudo cargar la agenda.'));
                }
            });
        this.loadSlots();
    }

    /** Reads the free slots in the future part of the period. */
    private loadSlots(): void {
        const userId = this.selectedErgonomistId();
        this.slotRequest?.unsubscribe();
        this.slotError.set(null);
        const now = new Date();
        const from = this.range.from > now ? this.range.from : now;
        if (userId === null || this.range.to <= from) {
            this.slots.set([]);
            this.isLoadingSlots.set(false);
            return;
        }
        this.isLoadingSlots.set(true);
        this.slotRequest = this.appointmentService
            .findFreeAvailabilities(userId, toLocalDateTime(from), toLocalDateTime(this.range.to))
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

    /** Opens the availability form, for the selected ergonomist when an administrator asks. */
    protected publishAvailability(): void {
        const userId = this.selectedErgonomistId();
        void this.router.navigate(['/appointments/availabilities/new'], this.isAdmin() && userId !== null ? { queryParams: { userId } } : {});
    }

    protected openBooking(): void {
        this.isBookingOpen.set(true);
    }

    /**
     * Adds the appointment just booked to the table and takes its slot out of the free ones.
     *
     * @param appointment appointment returned by the backend
     */
    protected onBooked(appointment: AppointmentResponse): void {
        const start = new Date(appointment.startDateTime);
        if (appointment.userId === this.selectedErgonomistId() && start >= this.range.from && start <= this.range.to) {
            this.appointments.update((appointments) => [...appointments, appointment]);
        }
        this.slots.update((slots) => slots.filter((slot) => !(slot.startDateTime === appointment.startDateTime && slot.endDateTime === appointment.endDateTime)));
    }

    /**
     * Opens the form of the personalized evaluation for an attended appointment.
     *
     * @param row appointment to evaluate
     */
    protected evaluate(row: AppointmentRow): void {
        void this.router.navigate(['/personalized-evaluations'], { queryParams: { appointmentId: row.id } });
    }

    /**
     * Asks for confirmation and cancels an appointment; its slot becomes free again.
     *
     * @param row appointment to cancel
     */
    protected async confirmCancel(row: AppointmentRow): Promise<void> {
        if (!row.isPending || this.cancellingId() !== null) {
            return;
        }
        const confirmed = await this.dialogService.confirm({
            title: 'Cancelar cita',
            message: `La cita de ${row.employeeName} se cancelará y el espacio quedará libre para otra reserva.`,
            confirmLabel: 'Cancelar cita',
            cancelLabel: 'Volver',
            destructive: true
        });
        if (!confirmed) {
            return;
        }
        this.cancellingId.set(row.id);
        this.appointmentService
            .cancel(row.id)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (appointment) => {
                    this.cancellingId.set(null);
                    this.toastService.success('Cita cancelada', row.employeeName);
                    this.appointments.update((appointments) => appointments.map((item) => (item.id === row.id ? { ...item, ...appointment } : item)));
                    // The slot is free again: only the slots are read, not the whole agenda.
                    this.loadSlots();
                },
                error: (error: unknown) => {
                    this.cancellingId.set(null);
                    this.toastService.error('No se pudo cancelar la cita', getApiErrorMessage(error, 'Intente de nuevo en unos minutos.'));
                }
            });
    }

    /**
     * Asks for confirmation and removes a free slot.
     *
     * @param slot slot to remove
     */
    protected async confirmDeleteSlot(slot: AvailabilityResponse): Promise<void> {
        if (this.deletingSlotId() !== null) {
            return;
        }
        const confirmed = await this.dialogService.confirm({
            title: 'Eliminar espacio',
            message: 'El espacio dejará de estar disponible para agendar citas.',
            confirmLabel: 'Eliminar',
            destructive: true
        });
        if (!confirmed) {
            return;
        }
        this.deletingSlotId.set(slot.id);
        this.appointmentService
            .deleteAvailability(slot.id)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: () => {
                    this.deletingSlotId.set(null);
                    this.slots.update((slots) => slots.filter((item) => item.id !== slot.id));
                    this.toastService.success('Espacio eliminado');
                },
                error: (error: unknown) => {
                    this.deletingSlotId.set(null);
                    this.toastService.error('No se pudo eliminar el espacio', getApiErrorMessage(error, 'Puede que ya tenga una cita agendada.'));
                }
            });
    }
}

/** Full name of a user, skipping the empty second last name. */
function fullNameOf(user: UserResponse): string {
    return [user.firstName, user.firstLastName, user.secondLastName].filter(Boolean).join(' ');
}
