import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, OnInit, computed, inject, input, numberAttribute, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormArray, FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { map } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { ProgressBarModule } from 'primeng/progressbar';
import { SkeletonModule } from 'primeng/skeleton';
import { TagModule } from 'primeng/tag';

import { AppFloatingConfigurator } from '../../../layout/component/app.floatingconfigurator';
import { BrandLogoComponent } from '../../../shared/components/brand-logo/brand-logo.component';
import { FormFieldComponent } from '../../../shared/components/form-field/form-field.component';
import { trackUnsavedChanges } from '../../../shared/forms/unsaved-changes';
import { FormResponse, QuestionResponse } from '../../../shared/models/form.model';
import { RiskLevel } from '../../../shared/models/risk-level.model';
import { SelfEvaluationRequest, SelfEvaluationResponse } from '../../../shared/models/self-evaluation.model';
import { applyApiErrors } from '../../../shared/utils/api-error';
import { markFormAsDirty, notBlank } from '../../../shared/utils/form';
import { RISK_LEVEL_LABELS, RISK_LEVEL_TAG_CLASSES } from '../../../shared/utils/labels';
import { FormService } from '../../forms/form.service';
import { SelfEvaluationService } from '../self-evaluation.service';

/** Option an employee can pick for a question. */
interface AnswerOption {
    label: string;
    score: number;
}

/**
 * Frequency scale offered for every question. The backend multiplies the score
 * by the weight of the question.
 *
 * TODO: confirm the scale and its scores with MGS, together with the score
 * ranges of SelfEvaluationService.calculateRiskLevel in the backend.
 */
const ANSWER_OPTIONS: readonly AnswerOption[] = [
    { label: 'Nunca', score: 0 },
    { label: 'A veces', score: 1 },
    { label: 'Frecuentemente', score: 2 },
    { label: 'Siempre', score: 3 }
];

/** Limits of SelfEvaluationRequestDTO in the backend. */
const LIMITS = { name: 150, email: 120, position: 100 };

/** What the employee should do next, depending on the calculated risk. */
const NEXT_STEPS: Record<RiskLevel, string> = {
    LOW: 'Su nivel de riesgo es bajo. Mantenga las pausas activas, una postura neutral y su estación de trabajo bien ajustada.',
    MEDIUM: 'Hay aspectos a mejorar. Tome pausas activas cada hora y ajuste la altura de su silla y pantalla. El equipo de MGS revisará sus respuestas.',
    HIGH: 'Su puesto requiere atención. El equipo de MGS le contactará para agendar una evaluación personalizada con un ergonomista.',
    CRITICAL: 'Su caso es prioritario. MGS le contactará a la brevedad para una evaluación personalizada. Si siente dolor, avise también a su jefatura o a salud ocupacional.'
};

const SUBMIT_FAILED_MESSAGE = 'No se pudo enviar la autoevaluación. Intente de nuevo en unos minutos.';

/**
 * Public screen where an employee of a client company answers the active form
 * and immediately sees the risk level calculated by the backend. The company
 * can come in the link (?companyId=5), so the employee does not have to type
 * it.
 */
@Component({
    selector: 'app-self-evaluation-form',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [ReactiveFormsModule, ButtonModule, InputNumberModule, InputTextModule, ProgressBarModule, SkeletonModule, TagModule, AppFloatingConfigurator, BrandLogoComponent, FormFieldComponent],
    templateUrl: './self-evaluation-form.component.html',
    styleUrl: './self-evaluation-form.component.scss'
})
export class SelfEvaluationFormComponent implements OnInit {
    private readonly formBuilder = inject(FormBuilder);

    private readonly formService = inject(FormService);

    private readonly selfEvaluationService = inject(SelfEvaluationService);

    private readonly destroyRef = inject(DestroyRef);

    private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

    /** Company of the employee, bound from the query string when the link includes it. */
    readonly companyId = input<number | undefined, unknown>(undefined, { transform: numberAttribute });

    protected readonly answerOptions = ANSWER_OPTIONS;

    protected readonly limits = LIMITS;

    protected readonly riskLevelLabels = RISK_LEVEL_LABELS;

    protected readonly riskLevelTagClasses = RISK_LEVEL_TAG_CLASSES;

    protected readonly nextSteps = NEXT_STEPS;

    protected readonly activeForm = signal<FormResponse | null>(null);

    protected readonly questionList = signal<QuestionResponse[]>([]);

    protected readonly result = signal<SelfEvaluationResponse | null>(null);

    protected readonly isLoading = signal(true);

    protected readonly isSubmitting = signal(false);

    protected readonly errorMessage = signal<string | null>(null);

    protected readonly hasCompanyInLink = signal(false);

    protected readonly hasLoadError = signal(false);

    protected readonly employeeForm = this.formBuilder.group({
        companyId: this.formBuilder.control<number | null>(null, [Validators.required, Validators.min(1)]),
        employeeName: this.formBuilder.nonNullable.control('', [Validators.required, notBlank, Validators.maxLength(LIMITS.name)]),
        employeeEmail: this.formBuilder.nonNullable.control('', [Validators.required, Validators.email, Validators.maxLength(LIMITS.email)]),
        employeePosition: this.formBuilder.nonNullable.control('', [Validators.maxLength(LIMITS.position)]),
        answerList: this.formBuilder.array<FormControl<number | null>>([])
    });

    /** Warns before closing the tab with answers that were not sent. */
    private readonly unsaved = trackUnsavedChanges(this.employeeForm);

    private readonly answers = toSignal(this.employeeForm.controls.answerList.valueChanges.pipe(map(() => this.answerList.getRawValue())), { initialValue: [] as (number | null)[] });

    protected readonly answeredCount = computed(() => this.answers().filter((answer) => answer !== null).length);

    protected readonly progress = computed(() => {
        const total = this.questionList().length;
        return total === 0 ? 0 : Math.round((this.answeredCount() / total) * 100);
    });

    ngOnInit(): void {
        const companyId = this.companyId();
        if (companyId !== undefined && !Number.isNaN(companyId) && companyId > 0) {
            this.employeeForm.patchValue({ companyId });
            this.hasCompanyInLink.set(true);
        }
        this.loadActiveForm();
    }

    /**
     * Returns the answer controls, one per question, typed for the template.
     *
     * @returns array of answer controls
     */
    protected get answerList(): FormArray<FormControl<number | null>> {
        return this.employeeForm.controls.answerList;
    }

    /**
     * Reads the form the employee has to answer and builds one answer control
     * per question.
     */
    protected loadActiveForm(): void {
        this.isLoading.set(true);
        this.hasLoadError.set(false);
        this.formService
            .findActive()
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (formList) => {
                    const form = formList[0] ?? null;
                    const questionList = [...(form?.questionList ?? [])].filter((question) => question.active !== false).sort((first, second) => first.questionOrder - second.questionOrder);
                    this.answerList.clear({ emitEvent: false });
                    questionList.forEach(() => this.answerList.push(this.formBuilder.control<number | null>(null, [Validators.required]), { emitEvent: false }));
                    this.answerList.updateValueAndValidity();
                    // Empty answers are the starting point, not changes to protect.
                    this.unsaved.markSaved();
                    this.activeForm.set(form);
                    this.questionList.set(questionList);
                    this.isLoading.set(false);
                },
                error: () => {
                    this.hasLoadError.set(true);
                    this.isLoading.set(false);
                }
            });
    }

    /**
     * Checks whether a question has to show that it is missing.
     *
     * @param index position of the question
     * @returns true after a failed submit while it has no answer
     */
    protected isUnanswered(index: number): boolean {
        const control = this.answerList.at(index);
        return control.invalid && (control.touched || control.dirty);
    }

    /**
     * Sends the answers to the backend and shows the calculated risk level.
     * When something is missing it scrolls to the first field or question the
     * employee has to complete.
     */
    protected submit(): void {
        if (this.isSubmitting()) {
            return;
        }
        const form = this.activeForm();
        const value = this.employeeForm.getRawValue();
        if (form === null || this.employeeForm.invalid || value.companyId === null) {
            markFormAsDirty(this.employeeForm);
            const missing = this.questionList().length - this.answeredCount();
            this.errorMessage.set(missing > 0 ? `Falta${missing === 1 ? '' : 'n'} ${missing} pregunta${missing === 1 ? '' : 's'} por responder. Revise también sus datos.` : 'Revise los datos marcados antes de enviar.');
            this.focusFirstInvalid();
            return;
        }

        const request: SelfEvaluationRequest = {
            formId: form.id,
            companyId: value.companyId,
            employeeName: value.employeeName.trim(),
            employeeEmail: value.employeeEmail.trim().toLowerCase(),
            employeePosition: value.employeePosition.trim() || undefined,
            answerList: this.questionList().map((question, index) => {
                const score = value.answerList[index] ?? 0;
                return { questionId: question.id, score, selectedOption: ANSWER_OPTIONS.find((option) => option.score === score)?.label ?? '' };
            })
        };

        this.isSubmitting.set(true);
        this.errorMessage.set(null);
        this.selfEvaluationService
            .submit(request)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (selfEvaluation) => {
                    this.isSubmitting.set(false);
                    this.unsaved.markSaved();
                    this.result.set(selfEvaluation);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                },
                error: (error: unknown) => {
                    this.isSubmitting.set(false);
                    this.errorMessage.set(applyApiErrors(this.employeeForm, error, SUBMIT_FAILED_MESSAGE));
                }
            });
    }

    /**
     * Scrolls to the first data field or question without a valid value and
     * moves the focus there, once the error styles are rendered.
     */
    private focusFirstInvalid(): void {
        const personalFields = ['employeeName', 'employeeEmail', 'employeePosition', 'companyId'] as const;
        const invalidField = personalFields.find((field) => this.employeeForm.controls[field].invalid && (field !== 'companyId' || !this.hasCompanyInLink()));
        const unansweredIndex = this.answerList.controls.findIndex((control) => control.invalid);
        const selector = invalidField ? `#${invalidField}` : unansweredIndex >= 0 ? `#question-${this.questionList()[unansweredIndex].id}` : null;
        if (selector === null) {
            return;
        }
        requestAnimationFrame(() => {
            const target = this.host.nativeElement.querySelector<HTMLElement>(selector);
            if (!target) {
                return;
            }
            target.scrollIntoView({ behavior: 'smooth', block: 'center' });
            const focusable = target.matches('input') ? target : target.querySelector<HTMLElement>('input');
            focusable?.focus({ preventScroll: true });
        });
    }
}
