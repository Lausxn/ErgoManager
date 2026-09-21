import { Component, inject, input, numberAttribute, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';

import { CompanyRequest } from '../../../shared/models/company.model';
import { CompanyService } from '../company.service';

const MAX_BUSINESS_NAME_LENGTH = 150;
const MAX_TAX_ID_LENGTH = 20;

/**
 * Form used to register a new client company or to edit an existing one. The
 * route parameter is bound to the id input, see withComponentInputBinding.
 */
@Component({
  selector: 'app-company-form',
  imports: [ReactiveFormsModule],
  templateUrl: './company-form.component.html',
  styleUrl: './company-form.component.css',
})
export class CompanyFormComponent {
  private readonly formBuilder = inject(FormBuilder);

  private readonly companyService = inject(CompanyService);

  private readonly router = inject(Router);

  /** Identifier of the company being edited, absent when creating a new one. */
  readonly id = input<number | undefined, unknown>(undefined, {
    transform: numberAttribute,
  });

  protected readonly companyForm = this.formBuilder.nonNullable.group({
    businessName: ['', [Validators.required, Validators.maxLength(MAX_BUSINESS_NAME_LENGTH)]],
    taxId: ['', [Validators.required, Validators.maxLength(MAX_TAX_ID_LENGTH)]],
    contactEmail: ['', [Validators.required, Validators.email]],
    phoneNumber: [''],
    address: [''],
  });

  protected readonly isSubmitting = signal(false);

  /**
   * Sends the form to the backend, creating or updating the company.
   */
  protected submit(): void {
    if (this.companyForm.invalid) {
      this.companyForm.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    const request: CompanyRequest = this.companyForm.getRawValue();
    const companyId = this.id();
    const saved$ =
      companyId === undefined
        ? this.companyService.create(request)
        : this.companyService.update(companyId, request);

    saved$.subscribe({
      next: () => {
        this.isSubmitting.set(false);
        void this.router.navigate(['/companies']);
      },
      error: () => this.isSubmitting.set(false),
    });
  }
}
