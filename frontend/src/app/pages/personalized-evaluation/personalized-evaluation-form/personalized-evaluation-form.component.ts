import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { InputNumberModule } from 'primeng/inputnumber';
import { SelectButtonModule } from 'primeng/selectbutton';
import { TagModule } from 'primeng/tag';
import { TextareaModule } from 'primeng/textarea';

import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { PersonalizedEvaluationRequest, PersonalizedEvaluationResponse } from '../../../shared/models/personalized-evaluation.model';
import { RiskLevel } from '../../../shared/models/risk-level.model';
import { isControlInvalid, markFormAsDirty } from '../../../shared/utils/form';
import { RISK_LEVEL_LABELS, RISK_LEVEL_TAG_CLASSES, toEnumOptions } from '../../../shared/utils/labels';
import { PersonalizedEvaluationService } from '../personalized-evaluation.service';

/**
 * Form where the ergonomist writes the evaluation of an attended appointment
 * and downloads the resulting PDF report.
 */
@Component({
    selector: 'app-personalized-evaluation-form',
    standalone: true,
    imports: [ReactiveFormsModule, ButtonModule, InputNumberModule, SelectButtonModule, TagModule, TextareaModule, PageHeaderComponent],
    templateUrl: './personalized-evaluation-form.component.html'
})
export class PersonalizedEvaluationFormComponent {
    private readonly formBuilder = inject(FormBuilder);

    private readonly personalizedEvaluationService = inject(PersonalizedEvaluationService);

    private readonly messageService = inject(MessageService);

    protected readonly riskLevelOptions = toEnumOptions(RISK_LEVEL_LABELS);

    protected readonly riskLevelLabels = RISK_LEVEL_LABELS;

    protected readonly riskLevelTagClasses = RISK_LEVEL_TAG_CLASSES;

    protected readonly evaluationForm = this.formBuilder.group({
        appointmentId: this.formBuilder.control<number | null>(null, [Validators.required, Validators.min(1)]),
        diagnosis: this.formBuilder.nonNullable.control('', [Validators.required]),
        recommendations: this.formBuilder.nonNullable.control('', [Validators.required]),
        riskLevel: this.formBuilder.nonNullable.control<RiskLevel>('MEDIUM', [Validators.required])
    });

    protected readonly savedEvaluation = signal<PersonalizedEvaluationResponse | null>(null);

    protected readonly isSubmitting = signal(false);

    protected readonly isDownloading = signal(false);

    /**
     * Checks whether a field has to show its error message.
     *
     * @param field name of the control
     * @returns true when the value is invalid and the user worked on it
     */
    protected isInvalid(field: string): boolean {
        return isControlInvalid(this.evaluationForm.get(field));
    }

    /**
     * Sends the evaluation to the backend.
     */
    protected submit(): void {
        const value = this.evaluationForm.getRawValue();
        if (this.evaluationForm.invalid || value.appointmentId === null) {
            markFormAsDirty(this.evaluationForm);
            return;
        }

        this.isSubmitting.set(true);
        const request: PersonalizedEvaluationRequest = { ...value, appointmentId: value.appointmentId };

        this.personalizedEvaluationService.create(request).subscribe({
            next: (evaluation) => {
                this.isSubmitting.set(false);
                this.savedEvaluation.set(evaluation);
                this.messageService.add({ severity: 'success', summary: 'Evaluación guardada', detail: evaluation.employeeName });
            },
            error: () => {
                this.isSubmitting.set(false);
                this.messageService.add({ severity: 'error', summary: 'No se pudo guardar', detail: 'Verifique el número de cita e intente de nuevo.' });
            }
        });
    }

    /**
     * Starts a new evaluation after one was saved.
     */
    protected startNew(): void {
        this.savedEvaluation.set(null);
        this.evaluationForm.reset({ appointmentId: null, diagnosis: '', recommendations: '', riskLevel: 'MEDIUM' });
    }

    /**
     * Downloads the PDF report of the evaluation just saved.
     *
     * @param id identifier of the evaluation
     */
    protected downloadReport(id: number): void {
        this.isDownloading.set(true);
        this.personalizedEvaluationService.downloadReport(id).subscribe({
            next: (report) => {
                this.isDownloading.set(false);
                const reportUrl = URL.createObjectURL(report);
                const link = document.createElement('a');
                link.href = reportUrl;
                link.download = `evaluacion-${id}.pdf`;
                link.click();
                URL.revokeObjectURL(reportUrl);
            },
            error: () => {
                this.isDownloading.set(false);
                this.messageService.add({ severity: 'error', summary: 'No se pudo descargar el reporte' });
            }
        });
    }
}
