import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AvatarModule } from 'primeng/avatar';
import { ButtonModule } from 'primeng/button';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { SelectButtonModule } from 'primeng/selectbutton';
import { SkeletonModule } from 'primeng/skeleton';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';

import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { StatCardComponent } from '../../../shared/components/stat-card/stat-card.component';
import { CompanyResponse } from '../../../shared/models/company.model';
import { ToastService } from '../../../shared/services/toast.service';
import { getApiErrorMessage } from '../../../shared/utils/api-error';
import { ACTIVE_TAG_CLASSES } from '../../../shared/utils/labels';
import { companyInitials } from '../company-initials';
import { CompanyService } from '../company.service';
import { DeactivateCompanyDialogComponent } from '../deactivate-company-dialog/deactivate-company-dialog.component';

type StatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE';

/** Placeholder rows drawn with skeletons while the companies load. */
const SKELETON_ROWS = Array.from({ length: 6 }, (_, index) => ({ id: index }));

/** Company with the values the table shows, computed once per change instead of on every render. */
interface CompanyRow extends CompanyResponse {
    initials: string;
    searchKey: string;
}

/**
 * Main page of the client companies: summary of their state and table with
 * their contact data and actions.
 */
@Component({
    selector: 'app-company-list',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        FormsModule,
        RouterLink,
        AvatarModule,
        ButtonModule,
        IconFieldModule,
        InputIconModule,
        InputTextModule,
        SelectButtonModule,
        SkeletonModule,
        TableModule,
        TagModule,
        TooltipModule,
        EmptyStateComponent,
        DeactivateCompanyDialogComponent,
        PageHeaderComponent,
        StatCardComponent
    ],
    templateUrl: './company-list.component.html'
})
export class CompanyListComponent {
    private readonly companyService = inject(CompanyService);
    private readonly toastService = inject(ToastService);
    private readonly destroyRef = inject(DestroyRef);
    private readonly companyList = signal<CompanyResponse[]>([]);
    protected readonly isLoading = signal(true);

    /** True when the last load failed, so the empty state can offer a retry. */
    protected readonly loadFailed = signal(false);
    protected readonly searchText = signal('');
    protected readonly statusFilter = signal<StatusFilter>('ALL');

    /** Ids of the companies with a request running, to avoid double clicks. */
    protected readonly busyIds = signal<ReadonlySet<number>>(new Set());

    /** Company shown in the deactivation pop-up. */
    protected readonly deactivationTarget = signal<CompanyResponse | null>(null);
    protected readonly isDeactivationDialogOpen = signal(false);
    protected readonly skeletonRows = SKELETON_ROWS;
    protected readonly activeTagClasses = ACTIVE_TAG_CLASSES;

    protected readonly statusOptions: { label: string; value: StatusFilter }[] = [
        { label: 'Todas', value: 'ALL' },
        { label: 'Activas', value: 'ACTIVE' },
        { label: 'Inactivas', value: 'INACTIVE' }
    ];

    protected readonly rows = computed<CompanyRow[]>(() =>
        this.companyList().map((company) => ({
            ...company,
            initials: companyInitials(company.businessName),
            searchKey: `${company.businessName} ${company.taxId} ${company.contactEmail}`.toLowerCase()
        }))
    );

    /** Figures of the summary cards, counted in a single pass. */
    protected readonly summary = computed(() => {
        const summary = { total: 0, active: 0, inactive: 0 };
        for (const company of this.companyList()) {
            summary.total++;
            if (company.active) {
                summary.active++;
            } else {
                summary.inactive++;
            }
        }
        return summary;
    });

    /** Rows left after the search box and the status filter. */
    protected readonly filteredRows = computed(() => {
        const search = this.searchText().trim().toLowerCase();
        const status = this.statusFilter();
        return this.rows().filter((row) => (status === 'ALL' || row.active === (status === 'ACTIVE')) && (search === '' || row.searchKey.includes(search)));
    });

    constructor() {
        this.loadCompanies();
    }

    /**
     * Reads the companies shown by the page.
     */
    protected loadCompanies(): void {
        this.isLoading.set(true);
        this.loadFailed.set(false);
        this.companyService
            .findAll()
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (companyList) => {
                    this.companyList.set(companyList);
                    this.isLoading.set(false);
                },
                error: (error: unknown) => {
                    this.isLoading.set(false);
                    this.loadFailed.set(true);
                    this.toastService.error('No se pudieron cargar las empresas', getApiErrorMessage(error, 'Intente de nuevo en unos minutos.'));
                }
            });
    }

    /**
     * Opens the pop-up that asks for confirmation before deactivating the company.
     *
     * @param row company to deactivate
     */
    protected confirmDeactivate(row: CompanyRow): void {
        if (!row.active || this.isBusy(row.id)) {
            return;
        }
        this.deactivationTarget.set(row);
        this.isDeactivationDialogOpen.set(true);
    }

    /**
     * Deactivates the company confirmed in the pop-up. Its evaluations and
     * history are kept.
     *
     * @param company company to deactivate
     */
    protected deactivate(company: CompanyResponse): void {
        if (this.isBusy(company.id)) {
            return;
        }
        this.setBusy(company.id, true);
        this.companyService
            .deactivate(company.id)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: () => {
                    this.setBusy(company.id, false);
                    this.isDeactivationDialogOpen.set(false);
                    this.toastService.success('Empresa desactivada', company.businessName);
                    this.updateCompany(company.id, { active: false });
                },
                error: (error: unknown) => {
                    this.setBusy(company.id, false);
                    this.isDeactivationDialogOpen.set(false);
                    this.toastService.error('No se pudo desactivar', getApiErrorMessage(error, 'Intente de nuevo en unos minutos.'));
                }
            });
    }

    /**
     * Activates again a company that was deactivated.
     *
     * @param row company to activate
     */
    protected activate(row: CompanyRow): void {
        if (row.active || this.isBusy(row.id)) {
            return;
        }
        this.setBusy(row.id, true);
        this.companyService
            .activate(row.id)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (company) => {
                    this.setBusy(row.id, false);
                    this.toastService.success('Empresa reactivada', row.businessName);
                    this.updateCompany(row.id, { ...company, active: true });
                },
                error: (error: unknown) => {
                    this.setBusy(row.id, false);
                    this.toastService.error('No se pudo reactivar', getApiErrorMessage(error, 'Intente de nuevo en unos minutos.'));
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

    /** Applies a change to one company of the list, without reading them all again. */
    private updateCompany(id: number, changes: Partial<CompanyResponse>): void {
        this.companyList.update((companies) => companies.map((company) => (company.id === id ? { ...company, ...changes } : company)));
    }
}
