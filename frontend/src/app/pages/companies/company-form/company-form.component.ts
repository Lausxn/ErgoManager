import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, input, numberAttribute, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { map, merge } from 'rxjs';
import { AvatarModule } from 'primeng/avatar';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { ProgressBarModule } from 'primeng/progressbar';
import { SkeletonModule } from 'primeng/skeleton';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';

import { HasUnsavedChanges } from '../../../core/guards/unsaved-changes.guard';
import { FormFieldComponent } from '../../../shared/components/form-field/form-field.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { SaveBarComponent } from '../../../shared/components/save-bar/save-bar.component';
import { trackUnsavedChanges } from '../../../shared/forms/unsaved-changes';
import { CompanyRequest, CompanyResponse } from '../../../shared/models/company.model';
import { ToastService } from '../../../shared/services/toast.service';
import { applyApiErrors, isConflict } from '../../../shared/utils/api-error';
import { markFormAsDirty, notBlank } from '../../../shared/utils/form';
import { ACTIVE_TAG_CLASSES } from '../../../shared/utils/labels';
import { companyInitials } from '../company-initials';
import { CompanyService } from '../company.service';

/** Limits of CompanyRequestDTO in the backend. */
const LIMITS = { businessName: 150, taxId: 20, contactEmail: 120, phoneNumber: 30, address: 200 } as const;

/** Message shown under the tax id when the backend answers HTTP 409. */
const DUPLICATED_TAX_ID_MESSAGE = 'Ya existe una empresa con esa cédula jurídica.';

/** Fields that must hold a valid value before saving. */
const REQUIRED_FIELDS = ['businessName', 'taxId', 'contactEmail'] as const;

/**
 * Form used to register a client company or to edit one. When editing, the
 * side summary also offers the public link its employees use to answer the
 * self evaluation.
 */
@Component({
    selector: 'app-company-form',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [ReactiveFormsModule, RouterLink, AvatarModule, ButtonModule, InputTextModule, ProgressBarModule, SkeletonModule, TagModule, TooltipModule, FormFieldComponent, PageHeaderComponent, SaveBarComponent],
    templateUrl: './company-form.component.html',
    styles: [
        `
            .company-link {
                display: flex;
                flex-direction: column;
                gap: 0.6rem;
                padding-top: 1.25rem;
                border-top: 1px solid var(--surface-border);
            }

            .company-link__box {
                display: flex;
                align-items: center;
                gap: 0.5rem;
                padding: 0.35rem 0.35rem 0.35rem 0.85rem;
                border: 1px solid var(--surface-border);
                border-radius: var(--mgs-radius-sm);
                background: var(--surface-ground);
            }

            .company-link__url {
                flex: 1;
                min-width: 0;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                font-size: 0.82rem;
                font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
                color: var(--text-color);
            }

            .company-link__lead {
                margin: 0;
                font-size: 0.84rem;
                line-height: 1.5;
                color: var(--text-color-secondary);
            }

            .company-contact {
                display: flex;
                flex-direction: column;
                gap: 0.5rem;
                margin: 0;
                padding: 0;
                list-style: none;
                font-size: 0.88rem;
                color: var(--text-color);

                li {
                    display: flex;
                    align-items: flex-start;
                    gap: 0.6rem;
                    min-width: 0;
                    overflow-wrap: anywhere;
                }

                i {
                    margin-top: 0.2rem;
                    color: var(--text-color-secondary);
                }
            }
        `
    ]
})
export class CompanyFormComponent implements OnInit, HasUnsavedChanges {
    private readonly formBuilder = inject(FormBuilder);
    private readonly companyService = inject(CompanyService);
    private readonly toastService = inject(ToastService);
    private readonly router = inject(Router);
    private readonly destroyRef = inject(DestroyRef);

    /** Identifier of the company being edited, absent when creating a new one. */
    readonly id = input<number | undefined, unknown>(undefined, { transform: numberAttribute });
    protected readonly limits = LIMITS;
    protected readonly activeTagClasses = ACTIVE_TAG_CLASSES;
    protected readonly taxIdErrors = { duplicated: DUPLICATED_TAX_ID_MESSAGE };

    protected readonly companyForm = this.formBuilder.nonNullable.group({
        businessName: ['', [Validators.required, notBlank, Validators.maxLength(LIMITS.businessName)]],
        taxId: ['', [Validators.required, notBlank, Validators.maxLength(LIMITS.taxId)]],
        contactEmail: ['', [Validators.required, notBlank, Validators.email, Validators.maxLength(LIMITS.contactEmail)]],
        phoneNumber: ['', [Validators.maxLength(LIMITS.phoneNumber)]],
        address: ['', [Validators.maxLength(LIMITS.address)]]
    });

    protected readonly unsaved = trackUnsavedChanges(this.companyForm);
    protected readonly errorMessage = signal<string | null>(null);
    protected readonly isSubmitting = signal(false);
    protected readonly isLoading = signal(false);

    /** Stored company, only when editing: shows its state. */
    protected readonly storedCompany = signal<CompanyResponse | null>(null);
    protected readonly isEditing = computed(() => this.id() !== undefined && !Number.isNaN(this.id()));

    /** Public link the employees of the company open to answer the self evaluation. */
    protected readonly selfEvaluationLink = computed(() => (this.isEditing() ? `${window.location.origin}/self-evaluation?companyId=${this.id()}` : ''));

    /** Every value of the form, recomputed after each change of value or status. */
    private readonly formValue = toSignal(merge(this.companyForm.valueChanges, this.companyForm.statusChanges).pipe(map(() => this.companyForm.getRawValue())), { initialValue: this.companyForm.getRawValue() });

    protected readonly preview = computed(() => {
        const { businessName, taxId, contactEmail, phoneNumber, address } = this.formValue();
        return {
            name: businessName.trim(),
            initials: companyInitials(businessName),
            taxId: taxId.trim(),
            email: contactEmail.trim(),
            phone: phoneNumber.trim(),
            address: address.trim()
        };
    });

    protected readonly requiredCount = REQUIRED_FIELDS.length;

    protected readonly completedCount = computed(() => {
        this.formValue();
        return REQUIRED_FIELDS.filter((field) => this.companyForm.controls[field].valid).length;
    });

    protected readonly progress = computed(() => Math.round((this.completedCount() / this.requiredCount) * 100));

    ngOnInit(): void {
        if (!this.isEditing()) {
            return;
        }
        this.isLoading.set(true);
        this.companyService
            .findById(this.id()!)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (company) => {
                    this.storedCompany.set(company);
                    this.companyForm.reset({
                        businessName: company.businessName,
                        taxId: company.taxId,
                        contactEmail: company.contactEmail,
                        phoneNumber: company.phoneNumber ?? '',
                        address: company.address ?? ''
                    });
                    this.unsaved.markSaved();
                    this.isLoading.set(false);
                },
                error: () => {
                    this.toastService.error('No se encontró la empresa', 'Puede que ya no exista.');
                    void this.router.navigate(['/companies']);
                }
            });
    }

    /** Called by unsavedChangesGuard before leaving the page. */
    canLeave(): boolean {
        return this.unsaved.canLeave();
    }

    /** Clears the messages of a failed save after the changes were discarded. */
    protected clearError(): void {
        this.errorMessage.set(null);
    }

    /** Copies the self evaluation link of the company to the clipboard. */
    protected async copyLink(): Promise<void> {
        const link = this.selfEvaluationLink();
        try {
            await navigator.clipboard.writeText(link);
            this.toastService.success('Enlace copiado', 'Compártalo con los colaboradores de la empresa.');
        } catch {
            this.toastService.error('No se pudo copiar el enlace', 'Selecciónelo y cópielo manualmente.');
        }
    }

    /** Sends validated data to the backend, keeping the values after an error. */
    protected submit(): void {
        if (this.isSubmitting()) {
            return;
        }
        if (this.companyForm.invalid) {
            markFormAsDirty(this.companyForm);
            this.errorMessage.set('Revise los campos marcados antes de guardar.');
            return;
        }

        this.errorMessage.set(null);
        this.isSubmitting.set(true);
        const request = this.buildRequest();
        const saved$ = this.isEditing() ? this.companyService.update(this.id()!, request) : this.companyService.create(request);

        saved$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
            next: (company) => {
                this.isSubmitting.set(false);
                this.unsaved.markSaved();
                this.toastService.success(this.isEditing() ? 'Empresa actualizada' : 'Empresa registrada', company.businessName);
                void this.router.navigate(['/companies']);
            },
            error: (error: unknown) => {
                this.isSubmitting.set(false);
                if (isConflict(error)) {
                    const taxId = this.companyForm.controls.taxId;
                    taxId.setErrors({ ...taxId.errors, duplicated: true });
                    taxId.markAsTouched();
                    this.errorMessage.set(DUPLICATED_TAX_ID_MESSAGE);
                    return;
                }
                this.errorMessage.set(applyApiErrors(this.companyForm, error, 'No se pudo guardar. Intente de nuevo.'));
            }
        });
    }

    /**
     * Builds the body of the request with clean values: trimmed text, email in
     * lower case and no blank optional fields.
     */
    private buildRequest(): CompanyRequest {
        const { businessName, taxId, contactEmail, phoneNumber, address } = this.companyForm.getRawValue();
        return {
            businessName: businessName.trim(),
            taxId: taxId.trim(),
            contactEmail: contactEmail.trim().toLowerCase(),
            phoneNumber: phoneNumber.trim() || undefined,
            address: address.trim() || undefined
        };
    }
}
