import { DatePipe, formatDate } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, LOCALE_ID, OnInit, computed, inject, input, numberAttribute, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormArray, FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { map, merge } from 'rxjs';
import { AvatarModule } from 'primeng/avatar';
import { ButtonModule } from 'primeng/button';
import { ProgressBarModule } from 'primeng/progressbar';
import { SelectModule } from 'primeng/select';
import { SkeletonModule } from 'primeng/skeleton';
import { TableModule } from 'primeng/table';
import { TextareaModule } from 'primeng/textarea';
import { TooltipModule } from 'primeng/tooltip';

import { HasUnsavedChanges } from '../../../core/guards/unsaved-changes.guard';
import { AuthService } from '../../../core/services/auth.service';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { FormFieldComponent } from '../../../shared/components/form-field/form-field.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { SaveBarComponent } from '../../../shared/components/save-bar/save-bar.component';
import { trackUnsavedChanges } from '../../../shared/forms/unsaved-changes';
import { AppointmentResponse } from '../../../shared/models/appointment.model';
import { FormResponse, QuestionResponse } from '../../../shared/models/form.model';
import { PersonalizedEvaluationRequest, PersonalizedEvaluationResponse } from '../../../shared/models/personalized-evaluation.model';
import { ToastService } from '../../../shared/services/toast.service';
import { applyApiErrors, getApiErrorMessage, isConflict } from '../../../shared/utils/api-error';
import { toLocalDateTime } from '../../../shared/utils/date-time';
import { markFormAsDirty, notBlank } from '../../../shared/utils/form';
import { AppointmentService } from '../../appointment-scheduling/appointment.service';
import { addDays, isPendingStatus } from '../../appointment-scheduling/appointment-utils';
import { FormService } from '../../forms/form.service';
import { PersonalizedEvaluationService } from '../personalized-evaluation.service';

/** Maximum length accepted for every diagnosis and recommendation. */
const MAX_TEXT_LENGTH = 1000;

/** Window of the appointments that can still be evaluated. */
const DAYS_BACK = 60;
const DAYS_AHEAD = 30;

/** Placeholder rows drawn as skeletons while the evaluations load. */
const SKELETON_ROWS = Array.from({ length: 4 }, (_, index) => ({ id: -index - 1 }));

const DUPLICATED_MESSAGE = 'Esta cita ya tiene una evaluación registrada.';
const FORM_LOAD_FAILED_MESSAGE = 'No se pudo cargar el formulario de evaluación personalizada.';

/** Pending appointment offered in the selector. */
interface AppointmentOption extends AppointmentResponse {
    label: string;
}

/** Evaluation with the values the table shows, computed once per load. */
interface EvaluationRow extends PersonalizedEvaluationResponse {
    initials: string;
}

/** Form controls used for the answer of one personalized evaluation question. */
type PersonalizedAnswerForm = FormGroup<{
    questionId: FormControl<number>;
    diagnosis: FormControl<string>;
    recommendation: FormControl<string>;
}>;

/**
 * Page where the ergonomist completes the active personalized evaluation form
 * for an attended appointment, downloads its PDF report and reviews previous
 * evaluations.
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
        SelectModule,
        SkeletonModule,
        TableModule,
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
    private readonly formService = inject(FormService);
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

    protected readonly activeForm = signal<FormResponse | null>(null);
    protected readonly questionList = signal<QuestionResponse[]>([]);
    protected readonly isLoadingForm = signal(true);
    protected readonly formError = signal<string | null>(null);

    protected readonly evaluationForm = this.formBuilder.group({
        appointmentId: this.formBuilder.control<number | null>(null, [Validators.required]),
        answerList: this.formBuilder.array<PersonalizedAnswerForm>([])
    });

    protected readonly unsaved = trackUnsavedChanges(this.evaluationForm);
    protected readonly appointmentErrors = { required: 'Elija la cita que atendió.' };

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

    protected readonly completedCount = computed(() => {
        this.formValue();

        let completed = this.evaluationForm.controls.appointmentId.valid ? 1 : 0;

        this.answerList.controls.forEach((answer) => {
            if (answer.controls.diagnosis.valid) {
                completed++;
            }

            if (answer.controls.recommendation.valid) {
                completed++;
            }
        });

        return completed;
    });

    protected readonly requiredCount = computed(() => 1 + this.questionList().length * 2);

    protected readonly progress = computed(() => {
        const total = this.requiredCount();
        return total === 0 ? 0 : Math.round((this.completedCount() / total) * 100);
    });

    protected readonly evaluationRows = computed<EvaluationRow[]>(() =>
        this.evaluations().map((evaluation) => {
            const [first = '', second = ''] = evaluation.employeeName.trim().split(/\s+/);

            return {
                ...evaluation,
                initials: `${first.charAt(0)}${second.charAt(0)}`.toUpperCase()
            };
        })
    );

    ngOnInit(): void {
        this.loadActiveForm();
        this.loadPendingAppointments();
        this.loadEvaluations();
    }

    /**
     * Returns the controls containing the diagnosis and recommendation of every
     * question of the personalized evaluation form.
     *
     * @returns array of answer controls
     */
    protected get answerList(): FormArray<PersonalizedAnswerForm> {
        return this.evaluationForm.controls.answerList;
    }

    /** Called by unsavedChangesGuard before leaving the page. */
    canLeave(): boolean {
        return this.unsaved.canLeave();
    }

    /**
     * Loads the active personalized evaluation form and creates one pair of
     * diagnosis and recommendation fields for every active question.
     */
    protected loadActiveForm(): void {
        this.isLoadingForm.set(true);
        this.formError.set(null);

        this.formService
            .findActivePersonalized()
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (form) => {
                    const questions = [...(form.questionList ?? [])].filter((question) => question.active !== false).sort((first, second) => first.questionOrder - second.questionOrder);

                    this.activeForm.set(form);
                    this.questionList.set(questions);
                    this.rebuildAnswerList(questions);
                    this.unsaved.markSaved();
                    this.isLoadingForm.set(false);
                },
                error: (error: unknown) => {
                    this.activeForm.set(null);
                    this.questionList.set([]);
                    this.answerList.clear({ emitEvent: false });
                    this.formError.set(getApiErrorMessage(error, FORM_LOAD_FAILED_MESSAGE));
                    this.isLoadingForm.set(false);
                }
            });
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
                    const pending = appointments.filter((appointment) => isPendingStatus(appointment.status) && !appointment.evaluated).sort((first, second) => first.startDateTime.localeCompare(second.startDateTime));

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
                    this.evaluations.set([...evaluations].sort((first, second) => second.evaluatedAt.localeCompare(first.evaluatedAt)));
                    this.isLoadingEvaluations.set(false);
                },
                error: (error: unknown) => {
                    this.isLoadingEvaluations.set(false);
                    this.evaluationsError.set(getApiErrorMessage(error, 'No se pudieron cargar sus evaluaciones.'));
                }
            });
    }

    /**
     * Returns the current length of a diagnosis field.
     *
     * @param index position of the question
     * @returns number of characters
     */
    protected diagnosisLength(index: number): number {
        return this.answerList.at(index).controls.diagnosis.value.length;
    }

    /**
     * Returns the current length of a recommendation field.
     *
     * @param index position of the question
     * @returns number of characters
     */
    protected recommendationLength(index: number): number {
        return this.answerList.at(index).controls.recommendation.value.length;
    }

    /** Clears the messages of a failed save after the changes were discarded. */
    protected clearError(): void {
        this.errorMessage.set(null);
    }

    /**
     * Sends the personalized evaluation using the active form and one diagnosis
     * and recommendation for every question.
     */
    protected submit(): void {
        if (this.isSubmitting()) {
            return;
        }

        const form = this.activeForm();
        const value = this.evaluationForm.getRawValue();

        if (form === null || this.evaluationForm.invalid || value.appointmentId === null) {
            markFormAsDirty(this.evaluationForm);
            this.errorMessage.set('Revise los campos marcados antes de guardar.');
            return;
        }

        const request: PersonalizedEvaluationRequest = {
            appointmentId: value.appointmentId,
            formId: form.id,
            answerList: value.answerList.map((answer) => ({
                questionId: answer.questionId,
                diagnosis: answer.diagnosis.trim(),
                recommendation: answer.recommendation.trim()
            }))
        };

        this.errorMessage.set(null);
        this.isSubmitting.set(true);

        this.personalizedEvaluationService
            .create(request)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (evaluation) => {
                    this.isSubmitting.set(false);
                    this.unsaved.markSaved();

                    this.pendingAppointments.update((appointments) => appointments.filter((appointment) => appointment.id !== value.appointmentId));
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
        this.evaluationForm.controls.appointmentId.reset(null);
        this.rebuildAnswerList(this.questionList());
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

    /**
     * Recreates the answer controls according to the questions of the active
     * personalized evaluation form.
     *
     * @param questions questions that must be evaluated
     */
    private rebuildAnswerList(questions: QuestionResponse[]): void {
        this.answerList.clear({ emitEvent: false });

        questions.forEach((question) => {
            this.answerList.push(
                this.formBuilder.group({
                    questionId: this.formBuilder.nonNullable.control(question.id),
                    diagnosis: this.formBuilder.nonNullable.control('', [Validators.required, notBlank, Validators.maxLength(MAX_TEXT_LENGTH)]),
                    recommendation: this.formBuilder.nonNullable.control('', [Validators.required, notBlank, Validators.maxLength(MAX_TEXT_LENGTH)])
                }),
                { emitEvent: false }
            );
        });

        this.answerList.updateValueAndValidity();
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
