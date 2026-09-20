import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { FormResponse } from '../../../shared/models/form.model';
import { SelfEvaluationResponse } from '../../../shared/models/self-evaluation.model';
import { FormService } from '../../forms/form.service';
import { SelfEvaluationService } from '../self-evaluation.service';

/**
 * Screen where an employee of a client company answers the active form and
 * immediately sees the risk level calculated by the backend.
 */
@Component({
  selector: 'app-self-evaluation-form',
  imports: [ReactiveFormsModule],
  templateUrl: './self-evaluation-form.component.html',
  styleUrl: './self-evaluation-form.component.css',
})
export class SelfEvaluationFormComponent {
  private readonly formBuilder = inject(FormBuilder);

  private readonly formService = inject(FormService);

  private readonly selfEvaluationService = inject(SelfEvaluationService);

  protected readonly activeForm = signal<FormResponse | null>(null);

  protected readonly result = signal<SelfEvaluationResponse | null>(null);

  protected readonly isSubmitting = signal(false);

  protected readonly employeeForm = this.formBuilder.nonNullable.group({
    companyId: [0, [Validators.required, Validators.min(1)]],
    employeeName: ['', [Validators.required]],
    employeeEmail: ['', [Validators.required, Validators.email]],
    employeePosition: [''],
  });

  constructor() {
    this.loadActiveForm();
  }

  /**
   * Reads the form the employee has to answer.
   */
  protected loadActiveForm(): void {
    this.formService.findActive().subscribe((formList) => this.activeForm.set(formList[0] ?? null));
  }

  /**
   * Sends the answers to the backend.
   */
  protected submit(): void {
    // TODO: build the answerList from the options chosen for every question.
    throw new Error('Submitting a self evaluation is not implemented yet');
  }
}
