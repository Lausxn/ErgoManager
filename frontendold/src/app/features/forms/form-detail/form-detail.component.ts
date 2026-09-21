import { Component, inject, input, numberAttribute, signal } from '@angular/core';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';

import { FormRequest } from '../../../shared/models/form.model';
import { FormService } from '../form.service';

const FIRST_PUBLICATION_YEAR = 2000;

/**
 * Editor of a self evaluation form and of the questions it contains.
 */
@Component({
  selector: 'app-form-detail',
  imports: [ReactiveFormsModule],
  templateUrl: './form-detail.component.html',
  styleUrl: './form-detail.component.css',
})
export class FormDetailComponent {
  private readonly formBuilder = inject(FormBuilder);

  private readonly formService = inject(FormService);

  private readonly router = inject(Router);

  /** Identifier of the form being edited, absent when creating a new one. */
  readonly id = input<number | undefined, unknown>(undefined, {
    transform: numberAttribute,
  });

  protected readonly formDetail = this.formBuilder.nonNullable.group({
    title: ['', [Validators.required]],
    description: [''],
    publicationYear: [
      new Date().getFullYear(),
      [Validators.required, Validators.min(FIRST_PUBLICATION_YEAR)],
    ],
    questionList: this.formBuilder.array([this.buildQuestionGroup(1)]),
  });

  protected readonly isSubmitting = signal(false);

  /**
   * Returns the questions of the form, typed for the template.
   *
   * @returns array of question groups
   */
  protected get questionList(): FormArray {
    return this.formDetail.controls.questionList;
  }

  /**
   * Appends an empty question at the end of the form.
   */
  protected addQuestion(): void {
    this.questionList.push(this.buildQuestionGroup(this.questionList.length + 1));
  }

  /**
   * Removes a question from the form.
   *
   * @param index position of the question
   */
  protected removeQuestion(index: number): void {
    this.questionList.removeAt(index);
  }

  /**
   * Sends the form to the backend, creating or updating it.
   */
  protected submit(): void {
    if (this.formDetail.invalid) {
      this.formDetail.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    const request = this.formDetail.getRawValue() as FormRequest;
    const formId = this.id();
    const saved$ =
      formId === undefined
        ? this.formService.create(request)
        : this.formService.update(formId, request);

    saved$.subscribe({
      next: () => {
        this.isSubmitting.set(false);
        void this.router.navigate(['/forms']);
      },
      error: () => this.isSubmitting.set(false),
    });
  }

  /**
   * Builds the controls of a single question.
   *
   * @param questionOrder position the question takes in the form
   * @returns group ready to be pushed into the question array
   */
  private buildQuestionGroup(questionOrder: number) {
    return this.formBuilder.nonNullable.group({
      statement: ['', [Validators.required]],
      questionOrder: [questionOrder, [Validators.required, Validators.min(1)]],
      weight: [1, [Validators.required, Validators.min(1)]],
    });
  }
}
