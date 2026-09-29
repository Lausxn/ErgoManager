import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, input, numberAttribute, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormArray, FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { map, merge } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { InputNumberModule } from 'primeng/inputnumber';
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
import { FormRequest, FormResponse } from '../../../shared/models/form.model';
import { ToastService } from '../../../shared/services/toast.service';
import { applyApiErrors, getApiFieldErrors } from '../../../shared/utils/api-error';
import { markFormAsDirty, notBlank } from '../../../shared/utils/form';
import { ACTIVE_TAG_CLASSES } from '../../../shared/utils/labels';
import { FormService } from '../form.service';

/** Limits of FormRequestDTO and QuestionRequestDTO in the backend. */
const LIMITS = { title: 150, description: 500, statement: 500 } as const;

const FIRST_PUBLICATION_YEAR = 2000;

/** Highest score of a single answer of the self evaluation (options score 0 to 3). */
const MAX_ANSWER_SCORE = 3;

/** Controls of one question of the editor. */
type QuestionGroup = FormGroup<{
    /** Stored id, sent on PUT so the backend updates the question in place. */
    id: FormControl<number | null>;
    statement: FormControl<string>;
    questionOrder: FormControl<number>;
    weight: FormControl<number | null>;
}>;

/** Raw value of a question, as kept in the snapshots of the save bar. */
interface QuestionValue {
    id: number | null;
    statement: string;
    questionOrder: number;
    weight: number | null;
}

/** Matches backend field names such as "questionList[2].statement". */
const QUESTION_FIELD_PATTERN = /^questionList\[(\d+)\]\.(\w+)$/;

/**
 * Editor of a self evaluation form and of its ordered, weighted questions.
 */
@Component({
    selector: 'app-form-detail',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [ReactiveFormsModule, RouterLink, ButtonModule, InputNumberModule, InputTextModule, SkeletonModule, TagModule, TextareaModule, TooltipModule, FormFieldComponent, PageHeaderComponent, SaveBarComponent],
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

    protected readonly limits = LIMITS;

    protected readonly firstPublicationYear = FIRST_PUBLICATION_YEAR;

    protected readonly maxAnswerScore = MAX_ANSWER_SCORE;

    protected readonly activeTagClasses = ACTIVE_TAG_CLASSES;

    protected readonly yearErrors = { min: `El año debe ser ${FIRST_PUBLICATION_YEAR} o posterior.`, required: 'Indique el año de publicación.' };

    protected readonly weightErrors = { min: 'El peso mínimo es 1.', required: 'Indique el peso de la pregunta.' };

    protected readonly statementErrors = { required: 'Escriba el enunciado de la pregunta.', pattern: 'Escriba el enunciado de la pregunta.' };

    protected readonly formDetail = this.formBuilder.group({
        title: this.formBuilder.nonNullable.control('', [Validators.required, notBlank, Validators.maxLength(LIMITS.title)]),
        description: this.formBuilder.nonNullable.control('', [Validators.maxLength(LIMITS.description)]),
        publicationYear: this.formBuilder.control<number | null>(new Date().getFullYear(), [Validators.required, Validators.min(FIRST_PUBLICATION_YEAR)]),
        questionList: this.formBuilder.array<QuestionGroup>([this.buildQuestionGroup({ id: null, statement: '', questionOrder: 1, weight: 1 })], [Validators.required, Validators.minLength(1)])
    });

    protected readonly unsaved = trackUnsavedChanges(this.formDetail, {
        restore: (snapshot) => {
            this.setQuestions(snapshot.questionList as QuestionValue[]);
            this.formDetail.reset(snapshot);
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
        const totalWeight = questionList.reduce((sum, question) => sum + (question.weight ?? 0), 0);
        return {
            title: title.trim(),
            year: publicationYear,
            questionCount: questionList.length,
            totalWeight,
            maxScore: MAX_ANSWER_SCORE * totalWeight,
            incompleteCount: this.questionList.controls.filter((question) => question.invalid).length
        };
    });

    ngOnInit(): void {
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
        this.questionList.push(this.buildQuestionGroup({ id: null, statement: '', questionOrder: index + 1, weight: 1 }));
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
                this.toastService.success(this.isEditing() ? 'Formulario actualizado' : 'Formulario creado', form.title);
                void this.router.navigate(['/forms']);
            },
            error: (error: unknown) => {
                this.isSubmitting.set(false);
                this.errorMessage.set(this.applyErrors(error));
            }
        });
    }

    /**
     * Shows the errors of a failed save. Errors of the questions come as
     * "questionList[0].statement", which the generic helper cannot place, so
     * they are marked on the right question here and summed up in the message.
     */
    private applyErrors(error: unknown): string {
        const message = applyApiErrors(this.formDetail, error, 'No se pudo guardar. Intente de nuevo.');
        const questionNumbers = new Set<number>();
        for (const [field, fieldMessage] of Object.entries(getApiFieldErrors(error))) {
            const match = QUESTION_FIELD_PATTERN.exec(field);
            if (!match) {
                continue;
            }
            const index = Number(match[1]);
            questionNumbers.add(index + 1);
            const control = this.questionList.at(index)?.get(match[2]);
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
        const questions = [...form.questionList].sort((first, second) => first.questionOrder - second.questionOrder).map((question, index) => ({ id: question.id, statement: question.statement, questionOrder: index + 1, weight: question.weight }));
        const questionList: QuestionValue[] = questions.length > 0 ? questions : [{ id: null, statement: '', questionOrder: 1, weight: 1 }];
        this.setQuestions(questionList);
        this.formDetail.reset({ title: form.title, description: form.description ?? '', publicationYear: form.publicationYear, questionList });
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
        return {
            title: title.trim(),
            description: description.trim() || undefined,
            publicationYear: publicationYear!,
            questionList: questionList.map((question, index) => ({
                id: question.id ?? undefined,
                statement: question.statement.trim(),
                questionOrder: index + 1,
                weight: question.weight!
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
            weight: this.formBuilder.control<number | null>(question.weight, [Validators.required, Validators.min(1)])
        });
    }
}
