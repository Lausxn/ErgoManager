import { Component, OnInit, inject, input, numberAttribute, signal } from '@angular/core';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { TooltipModule } from 'primeng/tooltip';

import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { FormRequest, QuestionResponse } from '../../../shared/models/form.model';
import { isControlInvalid, markFormAsDirty } from '../../../shared/utils/form';
import { FormService } from '../form.service';

const FIRST_PUBLICATION_YEAR = 2000;

/**
 * Editor of a self evaluation form and of the questions it contains.
 */
@Component({
    selector: 'app-form-detail',
    standalone: true,
    imports: [ReactiveFormsModule, RouterLink, ButtonModule, InputNumberModule, InputTextModule, TextareaModule, TooltipModule, PageHeaderComponent],
    templateUrl: './form-detail.component.html'
})
export class FormDetailComponent implements OnInit {
    private readonly formBuilder = inject(FormBuilder);

    private readonly formService = inject(FormService);

    private readonly messageService = inject(MessageService);

    private readonly router = inject(Router);

    /** Identifier of the form being edited, absent when creating a new one. */
    readonly id = input<number | undefined, unknown>(undefined, { transform: numberAttribute });

    protected readonly firstPublicationYear = FIRST_PUBLICATION_YEAR;

    protected readonly formDetail = this.formBuilder.nonNullable.group({
        title: ['', [Validators.required]],
        description: [''],
        publicationYear: [new Date().getFullYear(), [Validators.required, Validators.min(FIRST_PUBLICATION_YEAR)]],
        questionList: this.formBuilder.array([this.buildQuestionGroup(1)])
    });

    protected readonly isSubmitting = signal(false);

    protected readonly isEditing = signal(false);

    ngOnInit(): void {
        const formId = this.id();
        if (formId === undefined || Number.isNaN(formId)) {
            return;
        }
        this.isEditing.set(true);
        this.formService.findById(formId).subscribe((form) => {
            this.formDetail.patchValue({ title: form.title, description: form.description ?? '', publicationYear: form.publicationYear });
            this.questionList.clear();
            [...form.questionList].sort((first, second) => first.questionOrder - second.questionOrder).forEach((question) => this.questionList.push(this.buildQuestionGroup(question.questionOrder, question)));
        });
    }

    /**
     * Returns the questions of the form, typed for the template.
     *
     * @returns array of question groups
     */
    protected get questionList(): FormArray {
        return this.formDetail.controls.questionList;
    }

    /**
     * Checks whether a field has to show its error message.
     *
     * @param path path of the control inside the form
     * @returns true when the value is invalid and the user worked on it
     */
    protected isInvalid(path: string): boolean {
        return isControlInvalid(this.formDetail.get(path));
    }

    /**
     * Appends an empty question at the end of the form.
     */
    protected addQuestion(): void {
        this.questionList.push(this.buildQuestionGroup(this.questionList.length + 1));
    }

    /**
     * Removes a question from the form and renumbers the remaining ones.
     *
     * @param index position of the question
     */
    protected removeQuestion(index: number): void {
        this.questionList.removeAt(index);
        this.questionList.controls.forEach((question, position) => question.patchValue({ questionOrder: position + 1 }));
    }

    /**
     * Sends the form to the backend, creating or updating it.
     */
    protected submit(): void {
        if (this.formDetail.invalid || this.questionList.length === 0) {
            markFormAsDirty(this.formDetail);
            return;
        }

        this.isSubmitting.set(true);
        const request = this.formDetail.getRawValue() as FormRequest;
        const formId = this.id();
        const saved$ = this.isEditing() && formId !== undefined ? this.formService.update(formId, request) : this.formService.create(request);

        saved$.subscribe({
            next: () => {
                this.isSubmitting.set(false);
                this.messageService.add({ severity: 'success', summary: 'Formulario guardado', detail: request.title });
                void this.router.navigate(['/forms']);
            },
            error: () => {
                this.isSubmitting.set(false);
                this.messageService.add({ severity: 'error', summary: 'No se pudo guardar', detail: 'Revise los datos e intente de nuevo.' });
            }
        });
    }

    /**
     * Builds the controls of a single question.
     *
     * @param questionOrder position the question takes in the form
     * @param question      stored question to start from, when editing
     * @returns group ready to be pushed into the question array
     */
    private buildQuestionGroup(questionOrder: number, question?: QuestionResponse) {
        return this.formBuilder.nonNullable.group({
            statement: [question?.statement ?? '', [Validators.required]],
            questionOrder: [questionOrder, [Validators.required, Validators.min(1)]],
            weight: [question?.weight ?? 1, [Validators.required, Validators.min(1)]]
        });
    }
}
