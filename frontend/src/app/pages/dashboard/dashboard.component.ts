import { DatePipe, formatDate } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, LOCALE_ID, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { SkeletonModule } from 'primeng/skeleton';

import { AuthService } from '../../core/services/auth.service';
import { AppointmentResponse } from '../../shared/models/appointment.model';
import { DashboardSummary } from '../../shared/models/dashboard.model';
import { ToastService } from '../../shared/services/toast.service';
import { toLocalDateTime } from '../../shared/utils/date-time';
import { APPOINTMENT_STATUS_LABELS } from '../../shared/utils/labels';
import { AppointmentService } from '../appointment-scheduling/appointment.service';
import { addDays, isPendingStatus } from '../appointment-scheduling/appointment-utils';
import { DashboardService } from './dashboard.service';

/** Value shown by a figure while it is unknown, after a failed load. */
const UNKNOWN_VALUE = '—';

/** Working hours always shown by the day ruler; it grows when an appointment falls outside. */
const DAY_START_HOUR = 8;
const DAY_END_HOUR = 17;

/** Days read before today, to find the attended appointments still without an evaluation. */
const DAYS_BACK = 30;

/** Days after today listed under "Próximos días". */
const DAYS_AHEAD = 7;

/** Rows shown by each list, so the page stays short. */
const MAX_ROWS = 5;

/** How often the "Ahora" mark moves. */
const NOW_REFRESH_MS = 60_000;

/** Appointment drawn on the day ruler. */
interface TimelineBlock {
    id: number;
    employeeName: string;
    start: Date;
    end: Date;
    /** Position and length on the ruler, as a percentage of its width. */
    left: number;
    width: number;
    inProgress: boolean;
}

/** Row of the day ruler: the appointments of one ergonomist. */
interface TimelineLane {
    ownerId: number;
    name: string;
    blocks: TimelineBlock[];
}

/** Mark of an hour under the ruler. */
interface HourMark {
    date: Date;
    left: number;
}

/**
 * Home page of the signed in user. It answers "what do I have today?": the day
 * laid out on a ruler of working hours, the next days, the attended
 * appointments that still need their evaluation and, for the administrator,
 * the figures of the system.
 */
@Component({
    selector: 'app-dashboard',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [DatePipe, RouterLink, SkeletonModule],
    templateUrl: './dashboard.component.html',
    styleUrl: './dashboard.component.scss'
})
export class DashboardComponent {
    private readonly authService = inject(AuthService);
    private readonly dashboardService = inject(DashboardService);
    private readonly appointmentService = inject(AppointmentService);
    private readonly toastService = inject(ToastService);
    private readonly router = inject(Router);
    private readonly destroyRef = inject(DestroyRef);
    private readonly locale = inject(LOCALE_ID);

    protected readonly isAdmin = computed(() => this.authService.session()?.role === 'ADMIN');
    protected readonly daysAhead = DAYS_AHEAD;
    private readonly userId = computed(() => this.authService.session()?.userId);

    protected readonly now = signal(new Date());
    private readonly todayStart = computed(() => startOfDay(this.now()));

    private readonly appointments = signal<AppointmentResponse[]>([]);
    protected readonly isLoadingAppointments = signal(true);
    protected readonly appointmentsFailed = signal(false);

    private readonly summary = signal<DashboardSummary | null>(null);
    protected readonly isLoadingSummary = signal(true);

    /** First name of the signed in user, shown in the greeting. */
    private readonly firstName = computed(() => this.authService.session()?.fullName.trim().split(/\s+/)[0] ?? '');

    protected readonly greeting = computed(() => {
        const hour = this.now().getHours();
        const greeting = hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches';
        return this.firstName() ? `${greeting}, ${this.firstName()}` : greeting;
    });

    /** Appointments of today that were not cancelled, ordered by start. */
    private readonly todays = computed(() => {
        const from = this.todayStart();
        const to = addDays(from, 1);
        return this.appointments().filter((appointment) => {
            const start = new Date(appointment.startDateTime);
            return appointment.status !== 'CANCELLED' && start >= from && start < to;
        });
    });

    /** One line that tells how the day looks. */
    protected readonly dayLine = computed(() => {
        const todays = this.todays();
        const own = !this.isAdmin();
        if (todays.length === 0) {
            return own ? 'No tiene citas hoy.' : 'No hay citas hoy.';
        }
        const count = `${todays.length} ${todays.length === 1 ? 'cita' : 'citas'}`;
        const first = own ? `Tiene ${count} hoy.` : `Hoy hay ${count}.`;
        const now = this.now();
        const current = todays.find((appointment) => new Date(appointment.startDateTime) <= now && new Date(appointment.endDateTime) > now);
        if (current) {
            return `${first} La de ${current.employeeName} está en curso.`;
        }
        const next = todays.find((appointment) => new Date(appointment.startDateTime) > now);
        if (next) {
            return `${first} La siguiente es a las ${formatDate(next.startDateTime, 'shortTime', this.locale)} con ${next.employeeName}.`;
        }
        return `${first} Ya pasaron todas.`;
    });

    /** First and last hour of the ruler. */
    private readonly hours = computed(() => {
        let first = DAY_START_HOUR;
        let last = DAY_END_HOUR;
        for (const appointment of this.todays()) {
            const start = new Date(appointment.startDateTime);
            const end = new Date(appointment.endDateTime);
            first = Math.min(first, start.getHours());
            last = Math.max(last, end.getMinutes() > 0 ? end.getHours() + 1 : end.getHours());
        }
        return { first, last: Math.min(Math.max(last, first + 1), 24) };
    });

    /** Number of hours on the ruler, used to draw one line per hour. */
    protected readonly hourCount = computed(() => this.hours().last - this.hours().first);

    protected readonly hourMarks = computed<HourMark[]>(() => {
        const { first, last } = this.hours();
        const marks: HourMark[] = [];
        for (let hour = first; hour <= last; hour += 2) {
            marks.push({ date: this.atHour(hour), left: this.positionOf(this.atHour(hour)) });
        }
        // The closing hour gets its own mark only when it does not crowd the previous one.
        if (last - marks[marks.length - 1].date.getHours() >= 2) {
            marks.push({ date: this.atHour(last), left: 100 });
        }
        return marks;
    });

    /** Rows of the ruler: one per ergonomist with appointments today, the own one first. */
    protected readonly lanes = computed<TimelineLane[]>(() => {
        const now = this.now();
        const lanes = new Map<number, TimelineLane>();
        for (const appointment of this.todays()) {
            const start = new Date(appointment.startDateTime);
            const end = new Date(appointment.endDateTime);
            const own = appointment.userId === this.userId();
            const lane = lanes.get(appointment.userId) ?? { ownerId: appointment.userId, name: own && this.isAdmin() ? 'Usted' : appointment.ergonomistName, blocks: [] };
            const left = this.positionOf(start);
            lane.blocks.push({ id: appointment.id, employeeName: appointment.employeeName, start, end, left, width: Math.max(this.positionOf(end) - left, 1), inProgress: start <= now && end > now });
            lanes.set(appointment.userId, lane);
        }
        return [...lanes.values()].sort((a, b) => Number(b.ownerId === this.userId()) - Number(a.ownerId === this.userId()) || a.name.localeCompare(b.name));
    });

    /** Today's appointments as a list, which replaces the details of the ruler on small screens. */
    protected readonly todayList = computed(() => {
        const now = this.now();
        return this.todays().map((appointment) => ({ ...appointment, inProgress: new Date(appointment.startDateTime) <= now && new Date(appointment.endDateTime) > now }));
    });

    /** Where the "Ahora" mark goes, or null when the current time is outside the ruler. */
    protected readonly nowPosition = computed(() => {
        const position = this.positionOf(this.now());
        return position > 0 && position < 100 ? position : null;
    });

    /** Pending appointments of the next days, after today. */
    protected readonly nextDays = computed(() => {
        const from = addDays(this.todayStart(), 1);
        return this.appointments()
            .filter((appointment) => isPendingStatus(appointment.status) && new Date(appointment.startDateTime) >= from)
            .slice(0, MAX_ROWS)
            .map((appointment) => ({ ...appointment, statusLabel: APPOINTMENT_STATUS_LABELS[appointment.status] }));
    });

    /** Own appointments that already ended and still have no personalized evaluation, the latest first. */
    protected readonly toRegister = computed(() => {
        const now = this.now();
        return this.appointments()
            .filter((appointment) => appointment.userId === this.userId() && isPendingStatus(appointment.status) && !appointment.evaluated && new Date(appointment.endDateTime) <= now)
            .reverse()
            .slice(0, MAX_ROWS);
    });

    /** Figures of the system, with a dash while they could not be read. */
    protected readonly figures = computed(() => {
        const summary = this.summary();
        return [
            { label: 'Empresas activas', value: summary?.activeCompanies ?? UNKNOWN_VALUE },
            { label: 'Formularios activos', value: summary?.activeForms ?? UNKNOWN_VALUE },
            { label: 'Usuarios activos', value: summary?.activeUsers ?? UNKNOWN_VALUE }
        ];
    });

    constructor() {
        this.loadAppointments();
        if (this.isAdmin()) {
            this.loadSummary();
        }
        const timer = setInterval(() => this.now.set(new Date()), NOW_REFRESH_MS);
        this.destroyRef.onDestroy(() => clearInterval(timer));
    }

    /** Reads the appointments from some days back to the end of the next days. */
    protected loadAppointments(): void {
        const userId = this.userId();
        if (userId === undefined) {
            this.isLoadingAppointments.set(false);
            return;
        }
        const from = toLocalDateTime(addDays(this.todayStart(), -DAYS_BACK));
        const to = toLocalDateTime(addDays(this.todayStart(), DAYS_AHEAD + 1));
        const request: Observable<AppointmentResponse[]> = this.isAdmin() ? this.appointmentService.findAllAgendas(from, to) : this.appointmentService.findAgenda(userId, from, to);
        this.isLoadingAppointments.set(true);
        this.appointmentsFailed.set(false);
        request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
            next: (appointments) => {
                this.appointments.set([...appointments].sort((a, b) => a.startDateTime.localeCompare(b.startDateTime)));
                this.isLoadingAppointments.set(false);
            },
            error: () => {
                this.isLoadingAppointments.set(false);
                this.appointmentsFailed.set(true);
            }
        });
    }

    /** Opens the personalized evaluation of an attended appointment. */
    protected register(appointment: AppointmentResponse): void {
        void this.router.navigate(['/personalized-evaluations'], { queryParams: { appointmentId: appointment.id } });
    }

    private loadSummary(): void {
        this.dashboardService
            .getSummary()
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (summary) => {
                    this.summary.set(summary);
                    this.isLoadingSummary.set(false);
                },
                error: () => {
                    this.isLoadingSummary.set(false);
                    this.toastService.error('No se pudieron cargar los indicadores', 'Intente de nuevo en unos minutos.');
                }
            });
    }

    /** Today at the given hour. */
    private atHour(hour: number): Date {
        const date = new Date(this.todayStart());
        date.setHours(hour);
        return date;
    }

    /** Position of a time of today on the ruler, as a percentage of its width. */
    private positionOf(date: Date): number {
        const { first, last } = this.hours();
        const minutes = (date.getTime() - this.atHour(first).getTime()) / 60_000;
        return (minutes / ((last - first) * 60)) * 100;
    }
}

/** Midnight of the day of a date. */
function startOfDay(date: Date): Date {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    return start;
}
