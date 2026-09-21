import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import {
  PersonalizedEvaluationRequest,
  PersonalizedEvaluationResponse,
} from '../../../shared/models/personalized-evaluation.model';
import { RiskLevel } from '../../../shared/models/risk-level.model';
import { PersonalizedEvaluationService } from '../personalized-evaluation.service';

/**
 * Form where the ergonomist writes the evaluation of an attended appointment
 * and downloads the resulting PDF report.
 */
@Component({
  selector: 'app-personalized-evaluation-form',
  imports: [ReactiveFormsModule],
  templateUrl: './personalized-evaluation-form.component.html',
  styleUrl: './personalized-evaluation-form.component.css',
})
export class PersonalizedEvaluationFormComponent {
  private readonly formBuilder = inject(FormBuilder);

  private readonly personalizedEvaluationService = inject(PersonalizedEvaluationService);

  protected readonly riskLevelList: readonly RiskLevel[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

  protected readonly evaluationForm = this.formBuilder.nonNullable.group({
    appointmentId: [0, [Validators.required, Validators.min(1)]],
    diagnosis: ['', [Validators.required]],
    recommendations: ['', [Validators.required]],
    riskLevel: ['MEDIUM' as RiskLevel, [Validators.required]],
  });

  protected readonly savedEvaluation = signal<PersonalizedEvaluationResponse | null>(null);

  protected readonly isSubmitting = signal(false);

  /**
   * Sends the evaluation to the backend.
   */
  protected submit(): void {
    if (this.evaluationForm.invalid) {
      this.evaluationForm.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    const request: PersonalizedEvaluationRequest = this.evaluationForm.getRawValue();

    this.personalizedEvaluationService.create(request).subscribe({
      next: (evaluation) => {
        this.isSubmitting.set(false);
        this.savedEvaluation.set(evaluation);
      },
      error: () => this.isSubmitting.set(false),
    });
  }

  /**
   * Downloads the PDF report of the evaluation just saved.
   *
   * @param id identifier of the evaluation
   */
  protected downloadReport(id: number): void {
    this.personalizedEvaluationService.downloadReport(id).subscribe((report) => {
      const reportUrl = URL.createObjectURL(report);
      window.open(reportUrl, '_blank');
      URL.revokeObjectURL(reportUrl);
    });
  }
}
