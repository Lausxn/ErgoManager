import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, model, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { SkeletonModule } from 'primeng/skeleton';
import { TagModule } from 'primeng/tag';
import { TextareaModule } from 'primeng/textarea';

import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { AppointmentResponse, AvailabilityResponse } from '../../../shared/models/appointment.model';
import { CompanyResponse } from '../../../shared/models/company.model';
import { RiskLevel } from '../../../shared/models/risk-level.model';
import { SelfEvaluationResponse } from '../../../shared/models/self-evaluation.model';
import { ToastService } from '../../../shared/services/toast.service';
import { getApiErrorMessage, isConflict } from '../../../shared/utils/api-error';
import { toLocalDateTime } from '../../../shared/utils/date-time';
import { RISK_LEVEL_LABELS, RISK_LEVEL_TAG_CLASSES } from '../../../shared/utils/labels';
import { CompanyService } from '../../companies/company.service';
import { SelfEvaluationService } from '../../self-evaluation/self-evaluation.service';
import { AppointmentService } from '../appointment.service';
import { addDays, formatDuration, groupSlotsByDay, minutesBetween } from '../appointment-utils';

/** Days ahead in which the dialog offers free slots. */
const BOOKING_DAYS_AHEAD = 30;

const MAX_NOTES_LENGTH = 500;

/** Higher first: the employees at higher risk are the ones to attend first. */
const RISK_ORDER: Record<RiskLevel, number> = { CRITICAL: 3, HIGH: 2, MEDIUM: 1, LOW: 0 };

/** Self evaluation with the values the list shows. */
interface EvaluationChoice extends SelfEvaluationResponse {
    riskLabel: string;
    riskTagClass: string;
    searchKey: string;
    /** True when the loaded agenda already holds a pending appointment for it. */
    hasPendingAppointment: boolean;
}

/**
 * Dialog that books an appointment in four steps: the company, the self
 * evaluation of the employee, a free slot of the selected ergonomist and
 * optional notes.
 */
@Component({
    selector: 'app-booking-dialog',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [DatePipe, FormsModule, ButtonModule, DialogModule, IconFieldModule, InputIconModule, InputTextModule, SelectModule, SkeletonModule, TagModule, TextareaModule, EmptyStateComponent],
    templateUrl: './booking-dialog.component.html',
    styleUrl: './booking-dialog.component.scss'
})
export class BookingDialogComponent {
    private readonly appointmentService = inject(AppointmentService);
    private readonly companyService = inject(CompanyService);
    private readonly selfEvaluationService = inject(SelfEvaluationService);
    private readonly toastService = inject(ToastService);
    private readonly destroyRef = inject(DestroyRef);

    /** Whether the dialog is open, two-way bound by the agenda. */
    readonly visible = model(false);

    /** Ergonomist whose free slots are offered. */
    readonly ergonomistId = input<number | null>(null);

    /** Name of the ergonomist, shown in the header. */
    readonly ergonomistName = input('');

    /** Self evaluations that already have a pending appointment in the loaded agenda. */
    readonly pendingSelfEvaluationIds = input<ReadonlySet<number>>(new Set());

    /** Emitted with the appointment just booked. */
    readonly booked = output<AppointmentResponse>();
    protected readonly maxNotesLength = MAX_NOTES_LENGTH;
    protected readonly companies = signal<CompanyResponse[]>([]);
    protected readonly isLoadingCompanies = signal(false);
    protected readonly companyId = signal<number | null>(null);
    private readonly evaluations = signal<SelfEvaluationResponse[]>([]);
    protected readonly isLoadingEvaluations = signal(false);
    protected readonly evaluationError = signal<string | null>(null);
    protected readonly evaluationSearch = signal('');
    protected readonly selfEvaluationId = signal<number | null>(null);
    private readonly slots = signal<AvailabilityResponse[]>([]);
    protected readonly isLoadingSlots = signal(false);
    protected readonly slotError = signal<string | null>(null);
    protected readonly availabilityId = signal<number | null>(null);
    protected readonly notes = signal('');
    protected readonly isSubmitting = signal(false);
    protected readonly errorMessage = signal<string | null>(null);
    private companiesLoaded = false;

    private evaluationRequest?: Subscription;

    protected readonly evaluationChoices = computed<EvaluationChoice[]>(() => {
        const pending = this.pendingSelfEvaluationIds();
        return this.evaluations()
            .map((evaluation) => ({
                ...evaluation,
                riskLabel: RISK_LEVEL_LABELS[evaluation.riskLevel],
                riskTagClass: RISK_LEVEL_TAG_CLASSES[evaluation.riskLevel],
                searchKey: `${evaluation.employeeName} ${evaluation.employeeEmail}`.toLowerCase(),
                hasPendingAppointment: pending.has(evaluation.id)
            }))
            .sort((a, b) => RISK_ORDER[b.riskLevel] - RISK_ORDER[a.riskLevel] || b.submittedAt.localeCompare(a.submittedAt));
    });

    protected readonly filteredEvaluations = computed(() => {
        const search = this.evaluationSearch().trim().toLowerCase();
        return search === '' ? this.evaluationChoices() : this.evaluationChoices().filter((choice) => choice.searchKey.includes(search));
    });

    protected readonly slotDays = computed(() => groupSlotsByDay(this.slots()).map((day) => ({ ...day, slots: day.slots.map((slot) => ({ ...slot, duration: formatDuration(minutesBetween(slot.startDateTime, slot.endDateTime)) })) })));
    protected readonly selectedCompany = computed(() => this.companies().find((company) => company.id === this.companyId()) ?? null);
    protected readonly selectedEvaluation = computed(() => this.evaluationChoices().find((choice) => choice.id === this.selfEvaluationId()) ?? null);
    protected readonly selectedSlot = computed(() => this.slots().find((slot) => slot.id === this.availabilityId()) ?? null);
    protected readonly canSubmit = computed(() => this.selfEvaluationId() !== null && this.availabilityId() !== null && this.notes().length <= MAX_NOTES_LENGTH && !this.isSubmitting());

    /** Called when the dialog opens: starts from scratch and reads what it needs. */
    protected onShow(): void {
        this.companyId.set(null);
        this.evaluations.set([]);
        this.evaluationSearch.set('');
        this.selfEvaluationId.set(null);
        this.availabilityId.set(null);
        this.notes.set('');
        this.errorMessage.set(null);
        this.evaluationError.set(null);
        this.loadCompanies();
        this.loadSlots();
    }

    protected close(): void {
        this.visible.set(false);
    }

    /**
     * Keeps the chosen company and reads the self evaluations of its employees.
     *
     * @param companyId company chosen in the first step
     */
    protected selectCompany(companyId: number | null): void {
        this.companyId.set(companyId);
        this.selfEvaluationId.set(null);
        this.evaluations.set([]);
        this.evaluationSearch.set('');
        this.evaluationError.set(null);
        this.errorMessage.set(null);
        this.evaluationRequest?.unsubscribe();
        if (companyId === null) {
            return;
        }
        this.isLoadingEvaluations.set(true);
        this.evaluationRequest = this.selfEvaluationService
            .findByCompany(companyId)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (evaluations) => {
                    this.evaluations.set(evaluations);
                    this.isLoadingEvaluations.set(false);
                },
                error: (error: unknown) => {
                    this.isLoadingEvaluations.set(false);
                    this.evaluationError.set(getApiErrorMessage(error, 'No se pudieron cargar las autoevaluaciones de la empresa.'));
                }
            });
    }

    protected selectEvaluation(choice: EvaluationChoice): void {
        if (choice.hasPendingAppointment) {
            return;
        }
        this.selfEvaluationId.set(choice.id);
        this.errorMessage.set(null);
    }

    protected selectSlot(slot: AvailabilityResponse): void {
        this.availabilityId.set(slot.id);
        this.errorMessage.set(null);
    }

    /** Books the appointment with the chosen self evaluation and slot. */
    protected submit(): void {
        const selfEvaluationId = this.selfEvaluationId();
        const availabilityId = this.availabilityId();
        if (!this.canSubmit() || selfEvaluationId === null || availabilityId === null) {
            return;
        }
        this.errorMessage.set(null);
        this.isSubmitting.set(true);
        const notes = this.notes().trim();
        this.appointmentService
            .book({ selfEvaluationId, availabilityId, notes: notes || undefined })
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (appointment) => {
                    this.isSubmitting.set(false);
                    this.slots.update((slots) => slots.filter((slot) => slot.id !== availabilityId));
                    this.toastService.success('Cita agendada', `${appointment.employeeName} · ${this.selectedCompany()?.businessName ?? appointment.companyName}`);
                    this.booked.emit(appointment);
                    this.visible.set(false);
                },
                error: (error: unknown) => {
                    this.isSubmitting.set(false);
                    this.errorMessage.set(
                        isConflict(error) ? getApiErrorMessage(error, 'Esta autoevaluación ya tiene una cita pendiente o el espacio acaba de ser reservado.') : getApiErrorMessage(error, 'No se pudo agendar la cita. Intente de nuevo.')
                    );
                }
            });
    }

    /** Reads the active companies once per page visit. */
    private loadCompanies(): void {
        if (this.companiesLoaded) {
            return;
        }
        this.isLoadingCompanies.set(true);
        this.companyService
            .findAll()
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (companies) => {
                    this.companiesLoaded = true;
                    this.companies.set(companies.filter((company) => company.active).sort((a, b) => a.businessName.localeCompare(b.businessName)));
                    this.isLoadingCompanies.set(false);
                },
                error: (error: unknown) => {
                    this.isLoadingCompanies.set(false);
                    this.errorMessage.set(getApiErrorMessage(error, 'No se pudieron cargar las empresas.'));
                }
            });
    }

    /** Reads the free slots of the ergonomist for the coming days. */
    private loadSlots(): void {
        const userId = this.ergonomistId();
        this.slots.set([]);
        this.slotError.set(null);
        if (userId === null) {
            return;
        }
        const from = new Date();
        this.isLoadingSlots.set(true);
        this.appointmentService
            .findFreeAvailabilities(userId, toLocalDateTime(from), toLocalDateTime(addDays(from, BOOKING_DAYS_AHEAD)))
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (slots) => {
                    this.slots.set(slots.filter((slot) => !slot.taken));
                    this.isLoadingSlots.set(false);
                },
                error: (error: unknown) => {
                    this.isLoadingSlots.set(false);
                    this.slotError.set(getApiErrorMessage(error, 'No se pudieron cargar los espacios libres.'));
                }
            });
    }
}
