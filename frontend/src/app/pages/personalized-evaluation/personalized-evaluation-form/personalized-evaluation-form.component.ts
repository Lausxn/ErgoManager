import { DatePipe, formatDate } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, LOCALE_ID, OnInit, computed, inject, input, numberAttribute, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { map, merge } from 'rxjs';
import { AvatarModule } from 'primeng/avatar';
import { ButtonModule } from 'primeng/button';
import { ProgressBarModule } from 'primeng/progressbar';
import { RadioButtonModule } from 'primeng/radiobutton';
import { SelectModule } from 'primeng/select';
import { SkeletonModule } from 'primeng/skeleton';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TextareaModule } from 'primeng/textarea';
import { TooltipModule } from 'primeng/tooltip';

import { AuthService } from '../../../core/services/auth.service';
import { HasUnsavedChanges } from '../../../core/guards/unsaved-changes.guard';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { FormFieldComponent } from '../../../shared/components/form-field/form-field.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { SaveBarComponent } from '../../../shared/components/save-bar/save-bar.component';
import { trackUnsavedChanges } from '../../../shared/forms/unsaved-changes';
import { AppointmentResponse } from '../../../shared/models/appointment.model';
import { PersonalizedEvaluationRequest, PersonalizedEvaluationResponse } from '../../../shared/models/personalized-evaluation.model';
import { RiskLevel } from '../../../shared/models/risk-level.model';
import { ToastService } from '../../../shared/services/toast.service';
import { applyApiErrors, getApiErrorMessage, isConflict } from '../../../shared/utils/api-error';
import { toLocalDateTime } from '../../../shared/utils/date-time';
import { markFormAsDirty, notBlank } from '../../../shared/utils/form';
import { RISK_LEVEL_LABELS, RISK_LEVEL_TAG_CLASSES } from '../../../shared/utils/labels';
import { AppointmentService } from '../../appointment-scheduling/appointment.service';
import { addDays, isPendingStatus } from '../../appointment-scheduling/appointment-utils';
import { PersonalizedEvaluationService } from '../personalized-evaluation.service';

/** Limits of PersonalizedEvaluationRequestDTO in the backend. */
const MAX_TEXT_LENGTH = 1000;

/** Window of the appointments that can still be evaluated. */
const DAYS_BACK = 60;
const DAYS_AHEAD = 30;

/** Placeholder rows drawn as skeletons while the evaluations load. */
const SKELETON_ROWS = Array.from({ length: 4 }, (_, index) => ({ id: -index - 1 }));

const DUPLICATED_MESSAGE = 'Esta cita ya tiene una evaluación registrada.';

/** Pending appointment offered in the selector. */
interface AppointmentOption extends AppointmentResponse {
    label: string;
}

/** Evaluation with the values the table shows, computed once per load. */
interface EvaluationRow extends PersonalizedEvaluationResponse {
    initials: string;
    riskLabel: string;
    riskTagClass: string;
}

/** Card of a risk level, from the lowest to the highest. */
interface RiskChoice {
    value: RiskLevel;
    label: string;
    tagClass: string;
    description: string;
    icon: string;
    level: number;
}

/**
 * Page where the ergonomist writes the evaluation of an attended appointment,
 * downloads its PDF report and reviews the evaluations written before.
 */
@Component({
    selector: 'app-personalized-evaluation-form',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        DatePipe,
        ReactiveFormsModule,
        RouterLink,
        AvatarModule,
        ButtonModule,
        ProgressBarModule,
        RadioButtonModule,
        SelectModule,
        SkeletonModule,
        TableModule,
        TagModule,
        TextareaModule,
        TooltipModule,
        EmptyStateComponent,
        FormFieldComponent,
        PageHeaderComponent,
        SaveBarComponent
    ],
    templateUrl: './personalized-evaluation-form.component.html',
    styleUrl: './personalized-evaluation-form.component.scss'
})
export class PersonalizedEvaluationFormComponent implements OnInit, HasUnsavedChanges {
    private readonly formBuilder = inject(FormBuilder);

    private readonly personalizedEvaluationService = inject(PersonalizedEvaluationService);

    private readonly appointmentService = inject(AppointmentService);

    private readonly authService = inject(AuthService);

    private readonly toastService = inject(ToastService);

    private readonly destroyRef = inject(DestroyRef);

    private readonly locale = inject(LOCALE_ID);

    /** Appointment to preselect, from the ?appointmentId= query parameter. */
    readonly appointmentId = input<number | undefined, unknown>(undefined, { transform: numberAttribute });

    protected readonly maxTextLength = MAX_TEXT_LENGTH;

    protected readonly skeletonRows = SKELETON_ROWS;

    protected readonly riskLevelLabels = RISK_LEVEL_LABELS;

    protected readonly riskLevelTagClasses = RISK_LEVEL_TAG_CLASSES;

    protected readonly riskChoices: RiskChoice[] = [
        { value: 'LOW', description: 'Sin molestias relevantes. Mantener las buenas prácticas del puesto.', icon: 'fa-regular fa-face-smile', level: 1 },
        { value: 'MEDIUM', description: 'Molestias ocasionales. Conviene ajustar el puesto o los hábitos.', icon: 'fa-regular fa-face-meh', level: 2 },
        { value: 'HIGH', description: 'Molestias frecuentes. Requiere una intervención prioritaria.', icon: 'fa-solid fa-triangle-exclamation', level: 3 },
        { value: 'CRITICAL', description: 'Riesgo inmediato para la salud. Requiere acción urgente.', icon: 'fa-solid fa-heart-pulse', level: 4 }
    ].map((choice) => ({ ...choice, value: choice.value as RiskLevel, label: RISK_LEVEL_LABELS[choice.value as RiskLevel], tagClass: RISK_LEVEL_TAG_CLASSES[choice.value as RiskLevel] }));

    protected readonly riskLevels = [1, 2, 3, 4];

    protected readonly evaluationForm = this.formBuilder.group({
        appointmentId: this.formBuilder.control<number | null>(null, [Validators.required]),
        riskLevel: this.formBuilder.control<RiskLevel | null>(null, [Validators.required]),
        diagnosis: this.formBuilder.nonNullable.control('', [Validators.required, notBlank, Validators.maxLength(MAX_TEXT_LENGTH)]),
        recommendations: this.formBuilder.nonNullable.control('', [Validators.required, notBlank, Validators.maxLength(MAX_TEXT_LENGTH)])
    });

    protected readonly unsaved = trackUnsavedChanges(this.evaluationForm);

    protected readonly appointmentErrors = { required: 'Elija la cita que atendió.' };

    protected readonly riskErrors = { required: 'Elija el nivel de riesgo observado.' };

    private readonly pendingAppointments = signal<AppointmentResponse[]>([]);

    protected readonly isLoadingAppointments = signal(true);

    protected readonly appointmentsError = signal<string | null>(null);

    private readonly evaluations = signal<PersonalizedEvaluationResponse[]>([]);

    protected readonly isLoadingEvaluations = signal(true);

    protected readonly evaluationsError = signal<string | null>(null);

    protected readonly savedEvaluation = signal<PersonalizedEvaluationResponse | null>(null);

    protected readonly isSubmitting = signal(false);

    protected readonly errorMessage = signal<string | null>(null);

    /** Evaluations whose report is being downloaded. */
    protected readonly downloadingIds = signal<ReadonlySet<number>>(new Set());

    private readonly formValue = toSignal(merge(this.evaluationForm.valueChanges, this.evaluationForm.statusChanges).pipe(map(() => this.evaluationForm.getRawValue())), {
        initialValue: this.evaluationForm.getRawValue()
    });

    protected readonly appointmentOptions = computed<AppointmentOption[]>(() =>
        this.pendingAppointments().map((appointment) => ({
            ...appointment,
            label: `${appointment.employeeName} — ${appointment.companyName} — ${formatDate(appointment.startDateTime, 'd MMM y, h:mm a', this.locale)}`
        }))
    );

    protected readonly selectedAppointment = computed(() => {
        const id = this.formValue().appointmentId;
        return this.pendingAppointments().find((appointment) => appointment.id === id) ?? null;
    });

    protected readonly selectedRisk = computed(() => this.riskChoices.find((choice) => choice.value === this.formValue().riskLevel) ?? null);

    protected readonly diagnosisLength = computed(() => this.formValue().diagnosis.length);

    protected readonly recommendationsLength = computed(() => this.formValue().recommendations.length);

    protected readonly completedCount = computed(() => {
        this.formValue();
        return (['appointmentId', 'riskLevel', 'diagnosis', 'recommendations'] as const).filter((field) => this.evaluationForm.controls[field].valid).length;
    });

    protected readonly progress = computed(() => this.completedCount() * 25);

    protected readonly evaluationRows = computed<EvaluationRow[]>(() =>
        this.evaluations().map((evaluation) => {
            const [first = '', second = ''] = evaluation.employeeName.trim().split(/\s+/);
            return {
                ...evaluation,
                initials: `${first.charAt(0)}${second.charAt(0)}`.toUpperCase(),
                riskLabel: RISK_LEVEL_LABELS[evaluation.riskLevel],
                riskTagClass: RISK_LEVEL_TAG_CLASSES[evaluation.riskLevel]
            };
        })
    );

    ngOnInit(): void {
        this.loadPendingAppointments();
        this.loadEvaluations();
    }

    /** Called by unsavedChangesGuard before leaving the page. */
    canLeave(): boolean {
        return this.unsaved.canLeave();
    }

    /** Reads the appointments of the ergonomist that still wait for their evaluation. */
    protected loadPendingAppointments(): void {
        const userId = this.authService.session()?.userId;
        if (userId === undefined) {
            this.isLoadingAppointments.set(false);
            return;
        }
        const now = new Date();
        this.isLoadingAppointments.set(true);
        this.appointmentsError.set(null);
        this.appointmentService
            .findAgenda(userId, toLocalDateTime(addDays(now, -DAYS_BACK)), toLocalDateTime(addDays(now, DAYS_AHEAD)))
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (appointments) => {
                    const pending = appointments.filter((appointment) => isPendingStatus(appointment.status) && !appointment.evaluated).sort((a, b) => a.startDateTime.localeCompare(b.startDateTime));
                    this.pendingAppointments.set(pending);
                    this.isLoadingAppointments.set(false);
                    this.preselectRequestedAppointment();
                },
                error: (error: unknown) => {
                    this.isLoadingAppointments.set(false);
                    this.appointmentsError.set(getApiErrorMessage(error, 'No se pudieron cargar sus citas pendientes.'));
                }
            });
    }

    /** Reads the evaluations written by the ergonomist, newest first. */
    protected loadEvaluations(): void {
        const userId = this.authService.session()?.userId;
        if (userId === undefined) {
            this.isLoadingEvaluations.set(false);
            return;
        }
        this.isLoadingEvaluations.set(true);
        this.evaluationsError.set(null);
        this.personalizedEvaluationService
            .findByErgonomist(userId)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (evaluations) => {
                    this.evaluations.set([...evaluations].sort((a, b) => b.evaluatedAt.localeCompare(a.evaluatedAt)));
                    this.isLoadingEvaluations.set(false);
                },
                error: (error: unknown) => {
                    this.isLoadingEvaluations.set(false);
                    this.evaluationsError.set(getApiErrorMessage(error, 'No se pudieron cargar sus evaluaciones.'));
                }
            });
    }

    /** Clears the messages of a failed save after the changes were discarded. */
    protected clearError(): void {
        this.errorMessage.set(null);
    }

    /** Sends the evaluation, keeping the values after an error. */
    protected submit(): void {
        if (this.isSubmitting()) {
            return;
        }
        const { appointmentId, riskLevel, diagnosis, recommendations } = this.evaluationForm.getRawValue();
        if (this.evaluationForm.invalid || appointmentId === null || riskLevel === null) {
            markFormAsDirty(this.evaluationForm);
            this.errorMessage.set('Revise los campos marcados antes de guardar.');
            return;
        }

        this.errorMessage.set(null);
        this.isSubmitting.set(true);
        const request: PersonalizedEvaluationRequest = { appointmentId, riskLevel, diagnosis: diagnosis.trim(), recommendations: recommendations.trim() };
        this.personalizedEvaluationService
            .create(request)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (evaluation) => {
                    this.isSubmitting.set(false);
                    this.unsaved.markSaved();
                    this.pendingAppointments.update((appointments) => appointments.filter((appointment) => appointment.id !== appointmentId));
                    this.evaluations.update((evaluations) => [evaluation, ...evaluations]);
                    this.savedEvaluation.set(evaluation);
                    this.toastService.success('Evaluación guardada', evaluation.employeeName);
                },
                error: (error: unknown) => {
                    this.isSubmitting.set(false);
                    if (isConflict(error)) {
                        this.errorMessage.set(getApiErrorMessage(error, DUPLICATED_MESSAGE));
                        return;
                    }
                    this.errorMessage.set(applyApiErrors(this.evaluationForm, error, 'No se pudo guardar la evaluación. Intente de nuevo.'));
                }
            });
    }

    /** Starts a new evaluation after one was saved. */
    protected startNew(): void {
        this.evaluationForm.reset({ appointmentId: null, riskLevel: null, diagnosis: '', recommendations: '' });
        this.unsaved.markSaved();
        this.errorMessage.set(null);
        this.savedEvaluation.set(null);
    }

    /**
     * Downloads the PDF report of an evaluation.
     *
     * @param evaluation evaluation whose report is downloaded
     */
    protected downloadReport(evaluation: PersonalizedEvaluationResponse): void {
        if (this.downloadingIds().has(evaluation.id)) {
            return;
        }
        this.setDownloading(evaluation.id, true);
        this.personalizedEvaluationService
            .downloadReport(evaluation.id)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (report) => {
                    this.setDownloading(evaluation.id, false);
                    const reportUrl = URL.createObjectURL(report);
                    const link = document.createElement('a');
                    link.href = reportUrl;
                    link.download = `evaluacion-${slugify(evaluation.employeeName)}-${evaluation.id}.pdf`;
                    link.click();
                    URL.revokeObjectURL(reportUrl);
                },
                error: (error: unknown) => {
                    this.setDownloading(evaluation.id, false);
                    this.toastService.error('No se pudo descargar el reporte', getApiErrorMessage(error, 'Intente de nuevo en unos minutos.'));
                }
            });
    }

    private setDownloading(id: number, downloading: boolean): void {
        this.downloadingIds.update((ids) => {
            const next = new Set(ids);
            if (downloading) {
                next.add(id);
            } else {
                next.delete(id);
            }
            return next;
        });
    }

    /**
     * Selects the appointment requested from the agenda. It is not a change
     * of the user, so it becomes the saved value of the form.
     */
    private preselectRequestedAppointment(): void {
        const requested = this.appointmentId();
        if (requested === undefined || Number.isNaN(requested) || this.evaluationForm.dirty) {
            return;
        }
        if (this.pendingAppointments().some((appointment) => appointment.id === requested)) {
            this.evaluationForm.controls.appointmentId.setValue(requested);
            this.unsaved.markSaved();
        } else {
            this.toastService.info('La cita no está pendiente de evaluación', 'Puede que ya esté evaluada, cancelada o fuera del periodo.');
        }
    }
}

/**
 * Turns a name into a safe piece of a file name: "José Pérez" -> "jose-perez".
 *
 * @param text text to convert
 * @returns lower case words joined by dashes
 */
function slugify(text: string): string {
    return (
        text
            .normalize('NFD')
            .replace(/[̀-ͯ]/g, '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '') || 'colaborador'
    );
}
