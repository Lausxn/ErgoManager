import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { SelectButtonModule } from 'primeng/selectbutton';
import { SkeletonModule } from 'primeng/skeleton';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';

import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { StatCardComponent } from '../../../shared/components/stat-card/stat-card.component';
import { CompanyResponse } from '../../../shared/models/company.model';
import { FormResponse } from '../../../shared/models/form.model';
import { DialogService } from '../../../shared/services/dialog.service';
import { ToastService } from '../../../shared/services/toast.service';
import { getApiErrorMessage } from '../../../shared/utils/api-error';
import { ACTIVE_TAG_CLASSES } from '../../../shared/utils/labels';
import { CompanyService } from '../../companies/company.service';
import { FormService } from '../form.service';

type StatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE';

/** Placeholder rows drawn with skeletons while the forms load. */
const SKELETON_ROWS = Array.from({ length: 6 }, (_, index) => ({ id: index }));

/** Form with the values the table shows, computed once per change instead of on every render. */
interface FormRow extends FormResponse {
    questionCount: number;
    searchKey: string;
}

/** Option of the company select of the resend dialog. */
interface CompanyOption {
    id: number;
    label: string;
    taxId: string;
    contactEmail: string;
}

/**
 * Main page of the self evaluation forms: summary, table and the dialog that
 * sends a form again to the employees of a company.
 */
@Component({
    selector: 'app-form-list',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        FormsModule,
        RouterLink,
        ButtonModule,
        DialogModule,
        IconFieldModule,
        InputIconModule,
        InputTextModule,
        SelectModule,
        SelectButtonModule,
        SkeletonModule,
        TableModule,
        TagModule,
        TooltipModule,
        EmptyStateComponent,
        PageHeaderComponent,
        StatCardComponent
    ],
    templateUrl: './form-list.component.html',
    styles: [
        `
            .resend {
                display: flex;
                flex-direction: column;
                gap: 1.25rem;
            }

            .resend__form {
                display: flex;
                align-items: flex-start;
                gap: 0.85rem;
                padding: 1rem 1.1rem;
                border-radius: var(--mgs-radius-sm);
                background: var(--mgs-black);
                color: #fff;
                border-left: 4px solid var(--mgs-wine);
            }

            .resend__form i {
                margin-top: 0.2rem;
                font-size: 1.1rem;
                opacity: 0.8;
            }

            .resend__form-title {
                display: block;
                font-family: var(--mgs-font-display);
                font-weight: 700;
                line-height: 1.3;
            }

            .resend__form-meta {
                display: block;
                margin-top: 0.2rem;
                font-size: 0.82rem;
                opacity: 0.75;
            }

            .resend__option {
                display: flex;
                flex-direction: column;
                min-width: 0;
            }

            .resend__option-meta {
                font-size: 0.8rem;
                color: var(--text-color-secondary);
            }

            .resend__actions {
                display: flex;
                justify-content: flex-end;
                gap: 0.5rem;
            }

            /* The dialog renders inside this component, so its chrome can follow the brand here. */
            :host ::ng-deep .mgs-resend-dialog.p-dialog {
                border: 1px solid var(--surface-border);
                border-top: 4px solid var(--mgs-wine);
                border-radius: var(--mgs-radius);
                box-shadow: var(--mgs-shadow-md);
            }

            :host ::ng-deep .mgs-resend-dialog .p-dialog-title {
                font-family: var(--mgs-font-display);
                font-weight: 700;
                letter-spacing: -0.01em;
                color: var(--heading-color);
            }
        `
    ]
})
export class FormListComponent {
    private readonly formService = inject(FormService);
    private readonly companyService = inject(CompanyService);
    private readonly dialogService = inject(DialogService);
    private readonly toastService = inject(ToastService);
    private readonly destroyRef = inject(DestroyRef);
    private readonly formList = signal<FormResponse[]>([]);
    protected readonly isLoading = signal(true);
    protected readonly loadFailed = signal(false);
    protected readonly searchText = signal('');
    protected readonly statusFilter = signal<StatusFilter>('ALL');

    /** Ids of the forms with a request running, to avoid double clicks. */
    protected readonly busyIds = signal<ReadonlySet<number>>(new Set());
    protected readonly skeletonRows = SKELETON_ROWS;
    protected readonly activeTagClasses = ACTIVE_TAG_CLASSES;

    protected readonly statusOptions: { label: string; value: StatusFilter }[] = [
        { label: 'Todos', value: 'ALL' },
        { label: 'Activos', value: 'ACTIVE' },
        { label: 'Inactivos', value: 'INACTIVE' }
    ];

    /* ----- Resend dialog ----- */

    protected readonly resendForm = signal<FormRow | null>(null);
    protected readonly resendVisible = signal(false);
    protected readonly selectedCompanyId = signal<number | null>(null);
    protected readonly isSending = signal(false);

    /** Active companies, read only the first time the dialog opens. */
    protected readonly companyOptions = signal<CompanyOption[] | null>(null);
    protected readonly isLoadingCompanies = signal(false);
    protected readonly companiesFailed = signal(false);

    protected readonly rows = computed<FormRow[]>(() =>
        this.formList().map((form) => ({
            ...form,
            questionCount: form.questionList.length,
            searchKey: `${form.title} ${form.description ?? ''} ${form.publicationYear}`.toLowerCase()
        }))
    );

    /** Figures of the summary cards, counted in a single pass. */
    protected readonly summary = computed(() => {
        const summary = { total: 0, active: 0, activeQuestions: 0 };
        for (const form of this.formList()) {
            summary.total++;
            if (form.active) {
                summary.active++;
                summary.activeQuestions += form.questionList.length;
            }
        }
        return summary;
    });

    protected readonly filteredRows = computed(() => {
        const search = this.searchText().trim().toLowerCase();
        const status = this.statusFilter();
        return this.rows().filter((row) => (status === 'ALL' || row.active === (status === 'ACTIVE')) && (search === '' || row.searchKey.includes(search)));
    });

    constructor() {
        this.loadForms();
    }

    /**
     * Reads the forms shown by the page.
     */
    protected loadForms(): void {
        this.isLoading.set(true);
        this.loadFailed.set(false);
        this.formService
            .findAll()
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (formList) => {
                    this.formList.set(formList);
                    this.isLoading.set(false);
                },
                error: (error: unknown) => {
                    this.isLoading.set(false);
                    this.loadFailed.set(true);
                    this.toastService.error('No se pudieron cargar los formularios', getApiErrorMessage(error, 'Intente de nuevo en unos minutos.'));
                }
            });
    }

    /**
     * Asks for confirmation and deactivates the form, which stops being offered
     * to the employees. Its answers are kept.
     *
     * @param row form to deactivate
     */
    protected async confirmDeactivate(row: FormRow): Promise<void> {
        if (!row.active || this.isBusy(row.id)) {
            return;
        }
        const confirmed = await this.dialogService.confirm({
            title: 'Desactivar formulario',
            message: `"${row.title}" dejará de ofrecerse a los colaboradores y no podrá reenviarse. Las autoevaluaciones ya respondidas se conservan, y puede reactivarlo cuando quiera.`,
            confirmLabel: 'Desactivar',
            destructive: true
        });
        if (!confirmed) {
            return;
        }
        this.setBusy(row.id, true);
        this.formService
            .deactivate(row.id)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: () => {
                    this.setBusy(row.id, false);
                    this.toastService.success('Formulario desactivado', row.title);
                    this.updateForm(row.id, { active: false });
                },
                error: (error: unknown) => {
                    this.setBusy(row.id, false);
                    this.toastService.error('No se pudo desactivar', getApiErrorMessage(error, 'Intente de nuevo en unos minutos.'));
                }
            });
    }

    /**
     * Activates again a form that was deactivated.
     *
     * @param row form to activate
     */
    protected activate(row: FormRow): void {
        if (row.active || this.isBusy(row.id)) {
            return;
        }
        this.setBusy(row.id, true);
        this.formService
            .activate(row.id)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (form) => {
                    this.setBusy(row.id, false);
                    this.toastService.success('Formulario reactivado', row.title);
                    this.updateForm(row.id, { ...form, active: true });
                },
                error: (error: unknown) => {
                    this.setBusy(row.id, false);
                    this.toastService.error('No se pudo reactivar', getApiErrorMessage(error, 'Intente de nuevo en unos minutos.'));
                }
            });
    }

    /**
     * Opens the dialog to send an active form to a company. The companies are
     * read the first time only.
     *
     * @param row form to send
     */
    protected openResend(row: FormRow): void {
        if (!row.active) {
            return;
        }
        this.resendForm.set(row);
        this.selectedCompanyId.set(null);
        this.resendVisible.set(true);
        if (this.companyOptions() === null && !this.isLoadingCompanies()) {
            this.loadCompanies();
        }
    }

    /** Reads the active companies offered by the resend dialog. */
    protected loadCompanies(): void {
        this.isLoadingCompanies.set(true);
        this.companiesFailed.set(false);
        this.companyService
            .findAll()
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (companies) => {
                    this.companyOptions.set(
                        companies
                            .filter((company) => company.active)
                            .sort((first, second) => first.businessName.localeCompare(second.businessName, 'es'))
                            .map((company: CompanyResponse) => ({ id: company.id, label: company.businessName, taxId: company.taxId, contactEmail: company.contactEmail }))
                    );
                    this.isLoadingCompanies.set(false);
                },
                error: (error: unknown) => {
                    this.isLoadingCompanies.set(false);
                    this.companiesFailed.set(true);
                    this.toastService.error('No se pudieron cargar las empresas', getApiErrorMessage(error, 'Intente de nuevo en unos minutos.'));
                }
            });
    }

    /** Sends the form of the dialog to the selected company. */
    protected sendResend(): void {
        const form = this.resendForm();
        const companyId = this.selectedCompanyId();
        if (!form || companyId === null || this.isSending()) {
            return;
        }
        const company = this.companyOptions()?.find((option) => option.id === companyId);
        this.isSending.set(true);
        this.formService
            .resendAnnually(form.id, companyId)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: ({ recipientCount }) => {
                    this.isSending.set(false);
                    this.resendVisible.set(false);
                    if (recipientCount > 0) {
                        this.toastService.success('Formulario reenviado', `Se envió a ${recipientCount} correo(s).`);
                    } else {
                        // The contact email is always a recipient, so zero means every email failed.
                        this.toastService.error(
                            'No se envió ningún correo',
                            `El servidor no pudo entregar la invitación a ${company?.label ?? 'la empresa'}; intente de nuevo más tarde o comparta el enlace de autoevaluación desde la ficha de la empresa.`
                        );
                    }
                },
                error: (error: unknown) => {
                    this.isSending.set(false);
                    this.toastService.error('No se pudo reenviar', getApiErrorMessage(error, 'Intente de nuevo en unos minutos.'));
                }
            });
    }

    protected isBusy(id: number): boolean {
        return this.busyIds().has(id);
    }

    private setBusy(id: number, busy: boolean): void {
        this.busyIds.update((ids) => {
            const next = new Set(ids);
            if (busy) {
                next.add(id);
            } else {
                next.delete(id);
            }
            return next;
        });
    }

    /** Applies a change to one form of the list, without reading them all again. */
    private updateForm(id: number, changes: Partial<FormResponse>): void {
        this.formList.update((forms) => forms.map((form) => (form.id === id ? { ...form, ...changes } : form)));
    }
}
