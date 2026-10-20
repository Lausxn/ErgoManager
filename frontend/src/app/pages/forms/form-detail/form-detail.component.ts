import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, input, numberAttribute, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormArray, FormBuilder, FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators, AbstractControl } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { map, merge } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { InputNumberModule } from 'primeng/inputnumber';
import { SelectModule } from 'primeng/select';
import { InputTextModule } from 'primeng/inputtext';
import { SkeletonModule } from 'primeng/skeleton';
import { TagModule } from 'primeng/tag';
import { TextareaModule } from 'primeng/textarea';
import { TooltipModule } from 'primeng/tooltip';

import { HasUnsavedChanges } from '../../../core/guards/unsaved-changes.guard';
import { FormFieldComponent } from '../../../shared/components/form-field/form-field.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { SaveBarComponent } from '../../../shared/components/save-bar/save-bar.component';
import { trackUnsavedChanges } from '../../../shared/forms/unsaved-changes';
import { FormRequest, FormResponse, FormType } from '../../../shared/models/form.model';
import { ToastService } from '../../../shared/services/toast.service';
import { applyApiErrors, getApiFieldErrors } from '../../../shared/utils/api-error';
import { markFormAsDirty, notBlank } from '../../../shared/utils/form';
import { ACTIVE_TAG_CLASSES } from '../../../shared/utils/labels';
import { FormService } from '../form.service';
import { FormNavigationComponent } from '../form-navigation/form-navigation.component';

/** Limits of FormRequestDTO and QuestionRequestDTO in the backend. */
const LIMITS = { title: 150, description: 500, statement: 500, label: 100, questions: 100, options: 10 } as const;

const FIRST_PUBLICATION_YEAR = 2000;

type OptionGroup = FormGroup<{
    id: FormControl<number | null>;
    label: FormControl<string>;
    weight: FormControl<number | null>;
    optionOrder: FormControl<number>;
}>;
interface OptionValue {
    id: number | null;
    label: string;
    weight: number | null;
    optionOrder: number;
}
type QuestionGroup = FormGroup<{
    id: FormControl<number | null>;
    statement: FormControl<string>;
    questionOrder: FormControl<number>;
    optionList: FormArray<OptionGroup>;
}>;
interface QuestionValue {
    id: number | null;
    statement: string;
    questionOrder: number;
    optionList: OptionValue[];
}

/** Mirrors the per-question uniqueness rule without replacing backend validation. */
function uniqueOptions(control: AbstractControl) {
    const labels = (control.value as OptionValue[]).map((option) => option.label.trim().toLowerCase()).filter(Boolean);
    return new Set(labels).size === labels.length ? null : { duplicate: true };
}

@Component({
    selector: 'app-form-detail',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        FormsModule,
        SelectModule,
        ReactiveFormsModule,
        RouterLink,
        ButtonModule,
        InputNumberModule,
        InputTextModule,
        SkeletonModule,
        TagModule,
        TextareaModule,
        TooltipModule,
        FormNavigationComponent,
        FormFieldComponent,
        PageHeaderComponent,
        SaveBarComponent
    ],
    templateUrl: './form-detail.component.html',
    styles: [
        `
            .question-list {
                display: flex;
                flex-direction: column;
                gap: 1rem;
            }

            .question {
                padding: 1.1rem 1.25rem 1.25rem;
                border: 1px solid var(--surface-border);
                border-radius: var(--mgs-radius-sm);
                background: var(--surface-card);
                transition:
                    border-color 0.2s var(--mgs-ease),
                    box-shadow 0.2s var(--mgs-ease);
            }

            .question:focus-within {
                border-color: var(--mgs-graphite);
                box-shadow: var(--mgs-shadow-sm);
            }

            .question--invalid {
                border-left: 3px solid var(--mgs-wine);
            }

            .question__head {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 0.75rem;
                margin-bottom: 0.85rem;
            }

            .question__number {
                display: inline-flex;
                align-items: center;
                gap: 0.6rem;
                font-weight: 700;
                color: var(--heading-color);
            }

            .question__badge {
                display: inline-grid;
                place-items: center;
                min-width: 2rem;
                height: 2rem;
                padding: 0 0.4rem;
                border-radius: 999px;
                background: var(--mgs-black);
                color: #fff;
                font-size: 0.85rem;
                font-variant-numeric: tabular-nums;
            }

            .question__actions {
                display: flex;
                gap: 0.15rem;
            }

            .form-summary__score {
                display: flex;
                flex-direction: column;
                gap: 0.35rem;
                padding: 1.25rem;
                border-radius: var(--mgs-radius-sm);
                background: var(--mgs-black);
                color: #fff;
                border-top: 4px solid var(--mgs-wine);
            }

            .form-summary__score-label {
                font-size: 0.75rem;
                font-weight: 700;
                letter-spacing: 0.08em;
                text-transform: uppercase;
                opacity: 0.75;
            }

            .form-summary__score-value {
                font-family: var(--mgs-font-display);
                font-size: 2.5rem;
                font-weight: 800;
                line-height: 1;
                font-variant-numeric: tabular-nums;
            }

            .form-summary__score-note {
                font-size: 0.82rem;
                opacity: 0.75;
            }

            .form-add {
                display: flex;
                justify-content: center;
                margin-top: 1rem;
            }
        `
    ]
})
export class FormDetailComponent implements OnInit, HasUnsavedChanges {
    private readonly formBuilder = inject(FormBuilder);
    private readonly formService = inject(FormService);
    private readonly toastService = inject(ToastService);
    private readonly router = inject(Router);
    private readonly destroyRef = inject(DestroyRef);

    /** Identifier of the form being edited, absent when creating a new one. */
    readonly id = input<number | undefined, unknown>(undefined, { transform: numberAttribute });
    readonly category = input<'self-evaluation' | 'personalized'>('self-evaluation');
    protected readonly isPersonalized = computed(() => this.formValue().type === 'PERSONALIZED_EVALUATION');
    protected readonly typeOptions = [
        { label: 'Autoevaluación', value: 'SELF_EVALUATION' },
        { label: 'Evaluación personalizada', value: 'PERSONALIZED_EVALUATION' }
    ];
    protected readonly questionQuantities = Array.from({ length: 100 }, (_, index) => index + 1);
    protected readonly optionQuantities = Array.from({ length: 10 }, (_, index) => index + 1);
    protected readonly limits = LIMITS;
    protected readonly firstPublicationYear = FIRST_PUBLICATION_YEAR;
    protected readonly activeTagClasses = ACTIVE_TAG_CLASSES;
    protected readonly yearErrors = { min: `El año debe ser ${FIRST_PUBLICATION_YEAR} o posterior.`, required: 'Indique el año de publicación.' };
    protected readonly weightErrors = { min: 'El peso mínimo es 1.', max: 'El peso máximo es 3.', required: 'Indique el peso de la respuesta.' };
    protected readonly optionErrors = { duplicate: 'Las respuestas de una misma pregunta no se pueden repetir.', minlength: 'Agregue al menos una respuesta.', maxlength: 'Use un máximo de 10 respuestas.' };
    protected readonly statementErrors = { required: 'Escriba el enunciado de la pregunta.', pattern: 'Escriba el enunciado de la pregunta.' };

    protected readonly formDetail = this.formBuilder.group({
        type: this.formBuilder.nonNullable.control<FormType>('SELF_EVALUATION', Validators.required),
        title: this.formBuilder.nonNullable.control('', [Validators.required, notBlank, Validators.maxLength(LIMITS.title)]),
        description: this.formBuilder.nonNullable.control('', [Validators.maxLength(LIMITS.description)]),
        publicationYear: this.formBuilder.control<number | null>(new Date().getFullYear(), [Validators.required, Validators.min(FIRST_PUBLICATION_YEAR)]),
        questionList: this.formBuilder.array<QuestionGroup>([this.buildQuestionGroup(this.emptyQuestion(1))], [Validators.required, Validators.minLength(1), Validators.maxLength(100)])
    });

    protected readonly unsaved = trackUnsavedChanges(this.formDetail, {
        restore: (snapshot) => {
            this.setQuestions(snapshot.questionList as QuestionValue[]);
            this.formDetail.reset(snapshot);
            this.updateQuestionMode();
        }
    });

    protected readonly errorMessage = signal<string | null>(null);
    protected readonly isSubmitting = signal(false);
    protected readonly isLoading = signal(false);

    /** Stored form, only when editing: shows its state. */
    protected readonly storedForm = signal<FormResponse | null>(null);
    protected readonly isEditing = computed(() => this.id() !== undefined && !Number.isNaN(this.id()));

    /** Every value of the form, recomputed after each change of value or status. */
    private readonly formValue = toSignal(merge(this.formDetail.valueChanges, this.formDetail.statusChanges).pipe(map(() => this.formDetail.getRawValue())), { initialValue: this.formDetail.getRawValue() });

    /** Figures of the side summary. */
    protected readonly summary = computed(() => {
        const { title, publicationYear, questionList } = this.formValue();
        const optionCount = questionList.reduce((sum, question) => sum + question.optionList.length, 0);
        return {
            title: title.trim(),
            year: publicationYear,
            questionCount: questionList.length,
            optionCount,
            incompleteCount: this.questionList.controls.filter((question) => question.invalid).length
        };
    });

    ngOnInit(): void {
        this.formDetail.controls.type.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.updateQuestionMode());
        if (!this.isEditing()) {
            this.formDetail.controls.type.setValue(this.category() === 'personalized' ? 'PERSONALIZED_EVALUATION' : 'SELF_EVALUATION');
            this.unsaved.markSaved();
        }
        if (!this.isEditing()) {
            return;
        }
        this.isLoading.set(true);
        this.formService
            .findById(this.id()!)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (form) => {
                    this.storedForm.set(form);
                    this.loadForm(form);
                    this.isLoading.set(false);
                },
                error: () => {
                    this.toastService.error('No se encontró el formulario', 'Puede que ya no exista.');
                    void this.router.navigate(['/forms']);
                }
            });
    }

    /** Questions of the form, typed for the template. */
    protected get questionList(): FormArray<QuestionGroup> {
        return this.formDetail.controls.questionList;
    }

    /** Called by unsavedChangesGuard before leaving the page. */
    canLeave(): boolean {
        return this.unsaved.canLeave();
    }

    /** Clears the messages of a failed save after the changes were discarded. */
    protected clearError(): void {
        this.errorMessage.set(null);
    }

    /** Appends an empty question at the end of the form and focuses it. */
    protected addQuestion(): void {
        const index = this.questionList.length;
        if (index >= LIMITS.questions) return;
        this.questionList.push(this.buildQuestionGroup(this.emptyQuestion(index + 1)));
        this.updateQuestionMode();
        this.questionList.markAsDirty();
        requestAnimationFrame(() => document.getElementById(`statement-${index}`)?.focus());
    }

    /**
     * Removes a question and renumbers the remaining ones. The form keeps at
     * least one question.
     *
     * @param index position of the question
     */
    protected removeQuestion(index: number): void {
        if (this.questionList.length <= 1) {
            return;
        }
        this.questionList.removeAt(index);
        this.renumber();
    }

    /**
     * Moves a question one place up or down and renumbers the list.
     *
     * @param index  position of the question
     * @param offset -1 to move it up, 1 to move it down
     */
    protected moveQuestion(index: number, offset: -1 | 1): void {
        const target = index + offset;
        if (target < 0 || target >= this.questionList.length) {
            return;
        }
        const question = this.questionList.at(index);
        this.questionList.removeAt(index, { emitEvent: false });
        this.questionList.insert(target, question, { emitEvent: false });
        this.renumber();
    }

    /** Sends the form to the backend, creating or updating it. */
    protected submit(): void {
        if (this.isSubmitting()) {
            return;
        }
        if (this.formDetail.invalid) {
            markFormAsDirty(this.formDetail);
            const incomplete = this.summary().incompleteCount;
            this.errorMessage.set(incomplete > 0 ? `Revise los campos marcados: hay ${incomplete} pregunta(s) incompleta(s).` : 'Revise los campos marcados antes de guardar.');
            return;
        }

        this.errorMessage.set(null);
        this.isSubmitting.set(true);
        const request = this.buildRequest();
        const saved$ = this.isEditing() ? this.formService.update(this.id()!, request) : this.formService.create(request);

        saved$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
            next: (form) => {
                this.isSubmitting.set(false);
                this.unsaved.markSaved();
                this.toastService.success(this.isEditing() ? 'Formulario actualizado' : 'Formulario creado', this.isEditing() ? form.title : 'Borrador inactivo. Actívelo desde el listado cuando esté listo.');
                void this.router.navigate([form.type === 'PERSONALIZED_EVALUATION' ? '/forms/personalized' : '/forms/self-evaluation']);
            },
            error: (error: unknown) => {
                this.isSubmitting.set(false);
                this.errorMessage.set(this.applyErrors(error));
            }
        });
    }

    /**
     * Places indexed backend paths on question and option controls, retaining
     * the shared field messages and identifying the affected questions.
     */
    private applyErrors(error: unknown): string {
        const message = applyApiErrors(this.formDetail, error, 'No se pudo guardar. Intente de nuevo.');
        const questionNumbers = new Set<number>();
        for (const [field, fieldMessage] of Object.entries(getApiFieldErrors(error))) {
            const match = /^questionList\[(\d+)\](?:\.|$)/.exec(field);
            if (!match) continue;
            questionNumbers.add(Number(match[1]) + 1);
            const control = this.formDetail.get(field.replace(/\[(\d+)\]/g, '.$1'));
            if (control) {
                control.setErrors({ ...control.errors, server: fieldMessage });
                control.markAsTouched();
            }
        }
        if (questionNumbers.size > 0) {
            return `Revise las preguntas ${[...questionNumbers].sort((a, b) => a - b).join(', ')}: el servidor rechazó algunos datos.`;
        }
        return message;
    }

    /** Puts a stored form into the editor and takes it as the saved state. */
    private loadForm(form: FormResponse): void {
        const questions = [...(form.questionList ?? [])]
            .sort((a, b) => a.questionOrder - b.questionOrder)
            .map((question, index) => ({
                id: question.id,
                statement: question.statement,
                questionOrder: index + 1,
                optionList: [...(question.optionList ?? [])].sort((a, b) => a.optionOrder - b.optionOrder).map((option, optionIndex) => ({ id: option.id, label: option.label, weight: option.weight ?? null, optionOrder: optionIndex + 1 }))
            }));
        const questionList = questions.length ? questions : [this.emptyQuestion(1)];
        this.setQuestions(questionList);
        this.formDetail.reset({ type: form.type, title: form.title, description: form.description ?? '', publicationYear: form.publicationYear, questionList });
        this.formDetail.controls.type.disable();
        this.updateQuestionMode();
        this.unsaved.markSaved();
    }

    /** Rebuilds the question array with one group per value, without emitting in between. */
    private setQuestions(questions: QuestionValue[]): void {
        this.questionList.clear({ emitEvent: false });
        for (const question of questions) {
            this.questionList.push(this.buildQuestionGroup(question), { emitEvent: false });
        }
    }

    /** Gives every question its position as order, starting at 1. */
    private renumber(): void {
        this.questionList.controls.forEach((question, index) => question.controls.questionOrder.setValue(index + 1, { emitEvent: false }));
        this.questionList.markAsDirty();
        this.questionList.updateValueAndValidity();
    }

    /** Builds the body of the request with trimmed text and the order of the list. */
    private buildRequest(): FormRequest {
        const { title, description, publicationYear, questionList } = this.formDetail.getRawValue();
        const type = this.storedForm()?.type ?? this.formDetail.controls.type.value;
        return {
            type,
            title: title.trim(),
            description: description.trim() || undefined,
            publicationYear: publicationYear!,
            questionList: questionList.map((question, index) => ({
                id: question.id ?? undefined,
                statement: question.statement.trim(),
                questionOrder: index + 1,
                ...(type === 'SELF_EVALUATION' ? { optionList: question.optionList.map((option, optionIndex) => ({ id: option.id ?? undefined, label: option.label.trim(), weight: option.weight!, optionOrder: optionIndex + 1 })) } : {})
            }))
        };
    }

    /**
     * Builds the controls of a single question.
     *
     * @param question value to start from
     * @returns group ready to be pushed into the question array
     */
    private buildQuestionGroup(question: QuestionValue): QuestionGroup {
        return this.formBuilder.group({
            id: this.formBuilder.control<number | null>(question.id),
            statement: this.formBuilder.nonNullable.control(question.statement, [Validators.required, notBlank, Validators.maxLength(LIMITS.statement)]),
            questionOrder: this.formBuilder.nonNullable.control(question.questionOrder, [Validators.required, Validators.min(1)]),
            optionList: this.formBuilder.array<OptionGroup>(
                question.optionList.map((option) => this.buildOptionGroup(option)),
                [Validators.required, Validators.minLength(1), Validators.maxLength(10), uniqueOptions]
            )
        });
    }
    private emptyQuestion(order: number): QuestionValue {
        return { id: null, statement: '', questionOrder: order, optionList: [this.emptyOption(1)] };
    }
    private emptyOption(order: number): OptionValue {
        return { id: null, label: '', weight: 1, optionOrder: order };
    }
    private buildOptionGroup(option: OptionValue): OptionGroup {
        return this.formBuilder.group({
            id: this.formBuilder.control<number | null>(option.id),
            label: this.formBuilder.nonNullable.control(option.label, [Validators.required, notBlank, Validators.maxLength(LIMITS.label)]),
            weight: this.formBuilder.control<number | null>(option.weight, [Validators.required, Validators.min(1), Validators.max(3), Validators.pattern(/^[123]$/)]),
            optionOrder: this.formBuilder.nonNullable.control(option.optionOrder)
        });
    }
    /** Quantity controls only resize the editor; they are never serialized. Existing IDs survive. */
    protected resizeQuestions(count: number): void {
        if (!Number.isInteger(count) || count < 1 || count > LIMITS.questions) return;
        while (this.questionList.length > count) this.questionList.removeAt(this.questionList.length - 1);
        while (this.questionList.length < count) this.questionList.push(this.buildQuestionGroup(this.emptyQuestion(this.questionList.length + 1)));
        this.updateQuestionMode();
        this.renumber();
    }
    protected resizeOptions(index: number, count: number): void {
        if (!Number.isInteger(count) || count < 1 || count > LIMITS.options) return;
        const options = this.questionList.at(index).controls.optionList;
        while (options.length > count) options.removeAt(options.length - 1);
        while (options.length < count) options.push(this.buildOptionGroup(this.emptyOption(options.length + 1)));
        options.markAsDirty();
    }
    private updateQuestionMode(): void {
        const personalized = this.formDetail.controls.type.value === 'PERSONALIZED_EVALUATION';
        for (const question of this.questionList.controls) {
            if (personalized) question.controls.optionList.disable({ emitEvent: false });
            else question.controls.optionList.enable({ emitEvent: false });
        }
        this.formDetail.updateValueAndValidity();
    }
}
