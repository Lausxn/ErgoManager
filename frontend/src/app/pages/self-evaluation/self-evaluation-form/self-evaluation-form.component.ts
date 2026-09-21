import { Component, OnInit, inject, input, numberAttribute, signal } from '@angular/core';
import { FormArray, FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { RadioButtonModule } from 'primeng/radiobutton';
import { TagModule } from 'primeng/tag';

import { AppFloatingConfigurator } from '../../../layout/component/app.floatingconfigurator';
import { BrandLogoComponent } from '../../../shared/components/brand-logo/brand-logo.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { FormResponse, QuestionResponse } from '../../../shared/models/form.model';
import { SelfEvaluationRequest, SelfEvaluationResponse } from '../../../shared/models/self-evaluation.model';
import { isControlInvalid, markFormAsDirty } from '../../../shared/utils/form';
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

/**
 * Screen where an employee of a client company answers the active form and
 * immediately sees the risk level calculated by the backend. The company can
 * come in the link (?companyId=5), so the employee does not have to type it.
 */
@Component({
    selector: 'app-self-evaluation-form',
    standalone: true,
    imports: [ReactiveFormsModule, ButtonModule, InputNumberModule, InputTextModule, ProgressSpinnerModule, RadioButtonModule, TagModule, AppFloatingConfigurator, BrandLogoComponent, PageHeaderComponent],
    templateUrl: './self-evaluation-form.component.html'
})
export class SelfEvaluationFormComponent implements OnInit {
    private readonly formBuilder = inject(FormBuilder);

    private readonly formService = inject(FormService);

    private readonly selfEvaluationService = inject(SelfEvaluationService);

    /** Company of the employee, bound from the query string when the link includes it. */
    readonly companyId = input<number | undefined, unknown>(undefined, { transform: numberAttribute });

    protected readonly answerOptions = ANSWER_OPTIONS;

    protected readonly riskLevelLabels = RISK_LEVEL_LABELS;

    protected readonly riskLevelTagClasses = RISK_LEVEL_TAG_CLASSES;

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
        employeeName: this.formBuilder.nonNullable.control('', [Validators.required]),
        employeeEmail: this.formBuilder.nonNullable.control('', [Validators.required, Validators.email]),
        employeePosition: this.formBuilder.nonNullable.control(''),
        answerList: this.formBuilder.array<FormControl<number | null>>([])
    });

    ngOnInit(): void {
        const companyId = this.companyId();
        if (companyId !== undefined && !Number.isNaN(companyId)) {
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
     * Checks whether a field has to show its error message.
     *
     * @param path path of the control inside the form
     * @returns true when the value is invalid and the user worked on it
     */
    protected isInvalid(path: string): boolean {
        return isControlInvalid(this.employeeForm.get(path));
    }

    /**
     * Reads the form the employee has to answer and builds one answer control
     * per question.
     */
    protected loadActiveForm(): void {
        this.formService.findActive().subscribe({
            next: (formList) => {
                const form = formList[0] ?? null;
                const questionList = [...(form?.questionList ?? [])].filter((question) => question.active !== false).sort((first, second) => first.questionOrder - second.questionOrder);
                this.activeForm.set(form);
                this.questionList.set(questionList);
                this.answerList.clear();
                questionList.forEach(() => this.answerList.push(this.formBuilder.control<number | null>(null, [Validators.required])));
                this.isLoading.set(false);
            },
            error: () => {
                this.hasLoadError.set(true);
                this.isLoading.set(false);
            }
        });
    }

    /**
     * Sends the answers to the backend and shows the calculated risk level.
     */
    protected submit(): void {
        const form = this.activeForm();
        const value = this.employeeForm.getRawValue();
        if (form === null || this.employeeForm.invalid || value.companyId === null) {
            markFormAsDirty(this.employeeForm);
            this.errorMessage.set('Complete sus datos y responda todas las preguntas.');
            return;
        }

        const request: SelfEvaluationRequest = {
            formId: form.id,
            companyId: value.companyId,
            employeeName: value.employeeName,
            employeeEmail: value.employeeEmail,
            employeePosition: value.employeePosition || undefined,
            answerList: this.questionList().map((question, index) => {
                const score = value.answerList[index] ?? 0;
                return { questionId: question.id, score, selectedOption: ANSWER_OPTIONS.find((option) => option.score === score)?.label ?? '' };
            })
        };

        this.isSubmitting.set(true);
        this.errorMessage.set(null);
        this.selfEvaluationService.submit(request).subscribe({
            next: (selfEvaluation) => {
                this.isSubmitting.set(false);
                this.result.set(selfEvaluation);
                window.scrollTo({ top: 0, behavior: 'smooth' });
            },
            error: () => {
                this.isSubmitting.set(false);
                this.errorMessage.set('No se pudo enviar la autoevaluación. Revise el número de empresa e intente de nuevo.');
            }
        });
    }
}
