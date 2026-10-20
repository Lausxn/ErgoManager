import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, input, numberAttribute, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
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
import { applyApiErrors, getApiErrorMessage, isConflict } from '../../../shared/utils/api-error';
import { markFormAsDirty, matchesFormat, notBlank } from '../../../shared/utils/form';
import { ACTIVE_TAG_CLASSES } from '../../../shared/utils/labels';
import { companyInitials } from '../company-initials';
import { CompanyService } from '../company.service';

/** Limits of CompanyRequestDTO in the backend. */
const LIMITS = { businessName: 150, taxId: 20, contactEmail: 120, phoneNumber: 30, address: 200 } as const;

/** Message shown under the tax id when another company already uses it. */
const DUPLICATED_TAX_ID_MESSAGE = 'Ya existe una empresa con esa cédula jurídica.';

/** Message shown when the backend answers HTTP 409 without an explanation. */
const DUPLICATED_DATA_MESSAGE = 'Ya existe otra empresa con esos datos. Revise la razón social y la cédula jurídica.';

/** Message shown under the business name when another company already uses it. */
const DUPLICATED_BUSINESS_NAME_MESSAGE = 'Ya existe una empresa con esa razón social.';

/** Formats checked before saving, so the user learns what to fix without waiting for the server. */
const FORMATS = {
    businessName: /[\p{L}\p{N}]/u,
    taxId: /^[0-9]-[0-9]{3}-[0-9]{6}$/,
    phoneNumber: /^\+?(?:[ ()-]*[0-9]){8,15}[ ()-]*$/
} as const;

/** Messages of the format errors, each one explains the expected value. */
const FORMAT_MESSAGES = {
    businessName: 'La razón social debe incluir letras o números.',
    taxId: 'Escriba la cédula jurídica con el formato 3-101-123456.',
    phoneNumber: 'Escriba un teléfono válido de 8 a 15 dígitos, por ejemplo 2222-3333.'
} as const;

/** Names of the fields as the user reads them, used to list the ones to fix. */
const FIELD_LABELS = {
    businessName: 'Razón social',
    taxId: 'Cédula jurídica',
    contactEmail: 'Correo de contacto',
    phoneNumber: 'Teléfono',
    address: 'Dirección'
} as const;

/** Fields that must hold a valid value before saving. */
const REQUIRED_FIELDS = ['businessName', 'taxId', 'contactEmail'] as const;

/**
 * Turns a business name into the form used to compare it with the others,
 * the same rule as the backend: single spaces and lower case, but accents
 * count, so "CAFÉ  Sol" repeats "Café Sol" while "Cafe Sol" is another name.
 *
 * @param businessName name typed or stored
 * @returns comparable name
 */
function comparableBusinessName(businessName: string): string {
    return businessName.normalize('NFC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('es');
}

/**
 * Turns a tax id into the form used to compare it with the others, the same
 * rule as the backend: without dashes or spaces, so "3-101-123456" repeats
 * "3101123456".
 *
 * @param taxId tax id typed or stored
 * @returns comparable tax id
 */
function comparableTaxId(taxId: string): string {
    return taxId.replace(/[\s-]/g, '').toUpperCase();
}

/**
 * Writes the digits of a tax id with the dashes of the legal format
 * "3-101-123456". Only the first ten digits are kept.
 *
 * @param digits digits typed so far
 * @returns digits with their dashes
 */
function withTaxIdDashes(digits: string): string {
    return [digits.slice(0, 1), digits.slice(1, 4), digits.slice(4, 10)].filter(Boolean).join('-');
}

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
    protected readonly businessNameErrors = { duplicated: DUPLICATED_BUSINESS_NAME_MESSAGE, businessNameFormat: FORMAT_MESSAGES.businessName };
    protected readonly taxIdErrors = { duplicated: DUPLICATED_TAX_ID_MESSAGE, taxIdFormat: FORMAT_MESSAGES.taxId };
    protected readonly phoneNumberErrors = { phoneNumberFormat: FORMAT_MESSAGES.phoneNumber };

    /** Stored company, only when editing: shows its state. */
    protected readonly storedCompany = signal<CompanyResponse | null>(null);
    protected readonly isEditing = computed(() => this.id() !== undefined && !Number.isNaN(this.id()));

    /** Comparable business names of every other registered company, active or not. */
    private readonly takenBusinessNames = signal<ReadonlySet<string>>(new Set());

    /** Comparable tax ids of every other registered company, active or not. */
    private readonly takenTaxIds = signal<ReadonlySet<string>>(new Set());

    /** Rejects a business name already used by another registered company. */
    private readonly uniqueBusinessName: ValidatorFn = (control: AbstractControl): ValidationErrors | null => (this.takenBusinessNames().has(comparableBusinessName(control.value ?? '')) ? { duplicated: true } : null);

    /** Rejects a tax id already used by another registered company. */
    private readonly uniqueTaxId: ValidatorFn = (control: AbstractControl): ValidationErrors | null => (this.takenTaxIds().has(comparableTaxId(control.value ?? '')) ? { duplicated: true } : null);

    protected readonly companyForm = this.formBuilder.nonNullable.group({
        businessName: ['', [Validators.required, notBlank, Validators.maxLength(LIMITS.businessName), this.unlessStored('businessName', matchesFormat(FORMATS.businessName, 'businessNameFormat')), this.uniqueBusinessName]],
        taxId: ['', [Validators.required, notBlank, Validators.maxLength(LIMITS.taxId), this.unlessStored('taxId', matchesFormat(FORMATS.taxId, 'taxIdFormat')), this.uniqueTaxId]],
        contactEmail: ['', [Validators.required, notBlank, Validators.email, Validators.maxLength(LIMITS.contactEmail)]],
        phoneNumber: ['', [Validators.maxLength(LIMITS.phoneNumber), this.unlessStored('phoneNumber', matchesFormat(FORMATS.phoneNumber, 'phoneNumberFormat'))]],
        address: ['', [Validators.maxLength(LIMITS.address)]]
    });

    protected readonly unsaved = trackUnsavedChanges(this.companyForm);
    protected readonly errorMessage = signal<string | null>(null);
    protected readonly isSubmitting = signal(false);
    protected readonly isLoading = signal(false);

    /** True while the alert lists the fields to fix, so it follows the corrections of the user. */
    private readonly listsInvalidFields = signal(false);

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
        this.loadTakenValues();
        this.companyForm.statusChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.refreshInvalidFieldsAlert());
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

    /**
     * Reads the names and tax ids of the other registered companies, so a
     * repeated one is flagged while typing instead of after saving.
     */
    private loadTakenValues(): void {
        this.companyService
            .findAll()
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (companies) => this.rememberOtherCompanies(companies),
                error: () => this.toastService.error('No se pudo verificar si los datos ya existen', 'Confirme que ninguna otra empresa use la misma razón social o cédula jurídica.')
            });
    }

    /**
     * Keeps the names and tax ids of the companies other than the one being
     * edited and checks both fields again against them.
     *
     * @param companies every registered company
     */
    private rememberOtherCompanies(companies: CompanyResponse[]): void {
        const otherCompanies = companies.filter((company) => company.id !== this.id());
        this.takenBusinessNames.set(new Set(otherCompanies.map((company) => comparableBusinessName(company.businessName))));
        this.takenTaxIds.set(new Set(otherCompanies.map((company) => comparableTaxId(company.taxId))));
        this.companyForm.controls.businessName.updateValueAndValidity();
        this.companyForm.controls.taxId.updateValueAndValidity();
    }

    /**
     * Adds the dashes of the legal format while the tax id is typed or pasted,
     * keeping the cursor after the same digit. Only digits are accepted.
     *
     * @param event input event of the tax id field
     */
    protected formatTaxId(event: Event): void {
        const input = event.target as HTMLInputElement;
        const caret = input.selectionStart ?? input.value.length;
        const digitsBeforeCaret = input.value.slice(0, caret).replace(/\D/g, '').length;
        const formatted = withTaxIdDashes(input.value.replace(/\D/g, ''));
        if (formatted === input.value) {
            return;
        }
        input.value = formatted;
        this.companyForm.controls.taxId.setValue(formatted);
        // Place the cursor right after the same number of digits as before.
        let position = 0;
        for (let digits = 0; position < formatted.length && digits < digitsBeforeCaret; position++) {
            if (/\d/.test(formatted[position])) {
                digits++;
            }
        }
        input.setSelectionRange(position, position);
    }

    /**
     * Skips a format check while the field keeps the value already stored, so a
     * company registered before these formats existed can still be edited.
     * New values, and every value when creating, are checked.
     *
     * @param field     field whose stored value is compared
     * @param validator format check of the field
     * @returns validator that only checks new values
     */
    private unlessStored(field: 'businessName' | 'taxId' | 'phoneNumber', validator: ValidatorFn): ValidatorFn {
        return (control: AbstractControl): ValidationErrors | null => {
            const storedValue = this.storedCompany()?.[field]?.trim();
            return storedValue && control.value?.trim() === storedValue ? null : validator(control);
        };
    }

    /** Called by unsavedChangesGuard before leaving the page. */
    canLeave(): boolean {
        return this.unsaved.canLeave();
    }

    /** Clears the messages of a failed save after the changes were discarded. */
    protected clearError(): void {
        this.showMessage(null);
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
            this.listsInvalidFields.set(true);
            this.refreshInvalidFieldsAlert();
            return;
        }

        this.showMessage(null);
        this.isSubmitting.set(true);
        const request = this.buildRequest();
        const saved$ = this.isEditing() ? this.companyService.update(this.id()!, request) : this.companyService.create(request);

        saved$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
            next: (company) => {
                this.isSubmitting.set(false);
                this.unsaved.markSaved();
                this.toastService.success(this.isEditing() ? 'Empresa actualizada' : 'Perfil creado', company.businessName);
                void this.router.navigate(['/companies']);
            },
            error: (error: unknown) => {
                this.isSubmitting.set(false);
                if (isConflict(error)) {
                    this.showConflict(getApiErrorMessage(error, DUPLICATED_DATA_MESSAGE));
                    return;
                }
                this.showMessage(applyApiErrors(this.companyForm, error, 'No se pudo guardar. Intente de nuevo.'));
            }
        });
    }

    /**
     * Explains an HTTP 409. The backend only sends a message, so the registered
     * companies are read again: the live checks then mark the field that is
     * really taken, the business name, the tax id or both. When neither can be
     * found, only the message of the backend is shown.
     *
     * @param message explanation sent by the backend
     */
    private showConflict(message: string): void {
        this.showMessage(message);
        this.companyService
            .findAll()
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (companies) => {
                    this.rememberOtherCompanies(companies);
                    this.companyForm.controls.businessName.markAsTouched();
                    this.companyForm.controls.taxId.markAsTouched();
                },
                // Without the list the message of the backend is the only explanation left.
                error: () => undefined
            });
    }

    /**
     * Shows a message in the alert above the actions, or hides it.
     *
     * @param message text to show, null to hide the alert
     */
    private showMessage(message: string | null): void {
        this.listsInvalidFields.set(false);
        this.errorMessage.set(message);
    }

    /** Keeps the list of fields to fix up to date, and hides it once every field is valid. */
    private refreshInvalidFieldsAlert(): void {
        if (!this.listsInvalidFields()) {
            return;
        }
        if (this.companyForm.valid) {
            this.showMessage(null);
            return;
        }
        this.errorMessage.set(`Revise los campos marcados antes de guardar: ${this.invalidFieldLabels()}.`);
    }

    /**
     * Lists the fields that still hold an invalid value, in the order of the form.
     *
     * @returns names of the fields joined in a readable sentence
     */
    private invalidFieldLabels(): string {
        const labels = (Object.keys(FIELD_LABELS) as (keyof typeof FIELD_LABELS)[]).filter((field) => this.companyForm.controls[field].invalid).map((field) => FIELD_LABELS[field]);
        return labels.length > 1 ? `${labels.slice(0, -1).join(', ')} y ${labels.at(-1)}` : labels.join('');
    }

    /**
     * Builds the body of the request with clean values: trimmed text, single
     * spaces in the business name, email in lower case and no blank optional fields.
     */
    private buildRequest(): CompanyRequest {
        const { businessName, taxId, contactEmail, phoneNumber, address } = this.companyForm.getRawValue();
        return {
            businessName: businessName.trim().replace(/\s+/g, ' '),
            taxId: taxId.trim(),
            contactEmail: contactEmail.trim().toLowerCase(),
            phoneNumber: phoneNumber.trim() || undefined,
            address: address.trim() || undefined
        };
    }
}
