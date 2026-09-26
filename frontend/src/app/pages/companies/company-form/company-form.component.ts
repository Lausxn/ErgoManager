import { Component, OnInit, inject, input, numberAttribute, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';

import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { CompanyRequest } from '../../../shared/models/company.model';
import { isControlInvalid, markFormAsDirty } from '../../../shared/utils/form';
import { CompanyService } from '../company.service';

const MAX_BUSINESS_NAME_LENGTH = 150;
const MAX_TAX_ID_LENGTH = 20;

/**
 * Form used to register a new client company or to edit an existing one. The
 * route parameter is bound to the id input, see withComponentInputBinding.
 */
@Component({
    selector: 'app-company-form',
    standalone: true,
    imports: [ReactiveFormsModule, RouterLink, ButtonModule, InputTextModule, PageHeaderComponent],
    templateUrl: './company-form.component.html'
})
export class CompanyFormComponent implements OnInit {
    private readonly formBuilder = inject(FormBuilder);

    private readonly companyService = inject(CompanyService);

    private readonly messageService = inject(MessageService);

    private readonly router = inject(Router);

    /** Identifier of the company being edited, absent when creating a new one. */
    readonly id = input<number | undefined, unknown>(undefined, { transform: numberAttribute });

    protected readonly companyForm = this.formBuilder.nonNullable.group({
        businessName: ['', [Validators.required, Validators.maxLength(MAX_BUSINESS_NAME_LENGTH)]],
        taxId: ['', [Validators.required, Validators.maxLength(MAX_TAX_ID_LENGTH)]],
        contactEmail: ['', [Validators.required, Validators.email]],
        phoneNumber: [''],
        address: ['']
    });

    protected readonly isSubmitting = signal(false);

    protected readonly isEditing = signal(false);

    ngOnInit(): void {
        const companyId = this.id();
        if (companyId === undefined || Number.isNaN(companyId)) {
            return;
        }
        this.isEditing.set(true);
        this.companyService.findById(companyId).subscribe((company) => this.companyForm.patchValue(company));
    }

    /**
     * Checks whether a field has to show its error message.
     *
     * @param field name of the control
     * @returns true when the value is invalid and the user worked on it
     */
    protected isInvalid(field: string): boolean {
        return isControlInvalid(this.companyForm.get(field));
    }

    /**
     * Sends the form to the backend, creating or updating the company.
     */
    protected submit(): void {
        if (this.companyForm.invalid) {
            markFormAsDirty(this.companyForm);
            return;
        }

        this.isSubmitting.set(true);
        const request: CompanyRequest = this.companyForm.getRawValue();
        const companyId = this.id();
        const saved$ = this.isEditing() && companyId !== undefined ? this.companyService.update(companyId, request) : this.companyService.create(request);

        saved$.subscribe({
            next: () => {
                this.isSubmitting.set(false);
                this.messageService.add({ severity: 'success', summary: 'Empresa guardada', detail: request.businessName });
                void this.router.navigate(['/companies']);
            },
            error: () => {
                this.isSubmitting.set(false);
                this.messageService.add({ severity: 'error', summary: 'No se pudo guardar', detail: 'Revise los datos e intente de nuevo.' });
            }
        });
    }
}
