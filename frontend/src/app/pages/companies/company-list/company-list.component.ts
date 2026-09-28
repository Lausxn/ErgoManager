import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ConfirmationService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { Table, TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';

import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { CompanyResponse } from '../../../shared/models/company.model';
import { ToastService } from '../../../shared/services/toast.service';
import { ACTIVE_TAG_CLASSES } from '../../../shared/utils/labels';
import { CompanyService } from '../company.service';

/**
 * Table of client companies registered in ErgoManager.
 */
@Component({
    selector: 'app-company-list',
    standalone: true,
    imports: [RouterLink, ButtonModule, IconFieldModule, InputIconModule, InputTextModule, TableModule, TagModule, TooltipModule, PageHeaderComponent],
    templateUrl: './company-list.component.html'
})
export class CompanyListComponent {
    private readonly companyService = inject(CompanyService);

    private readonly confirmationService = inject(ConfirmationService);

    private readonly toastService = inject(ToastService);

    protected readonly companyList = signal<CompanyResponse[]>([]);

    protected readonly isLoading = signal(true);

    protected readonly activeTagClasses = ACTIVE_TAG_CLASSES;

    constructor() {
        this.loadCompanies();
    }

    /**
     * Reads companies from the backend.
     */
    protected loadCompanies(): void {
        this.isLoading.set(true);
        this.companyService.findAll().subscribe({
            next: (companyList) => {
                this.companyList.set(companyList);
                this.isLoading.set(false);
            },
            error: () => {
                this.isLoading.set(false);
                this.toastService.error('No se pudieron cargar los clientes', 'Verifique la conexión e intente nuevamente.');
            }
        });
    }

    protected filterTable(table: Table, event: Event): void {
        table.filterGlobal((event.target as HTMLInputElement).value, 'contains');
    }

    /**
     * Confirms and deactivates a client company.
     *
     * @param company company to deactivate
     */
    protected confirmDeactivate(company: CompanyResponse): void {
        this.confirmationService.confirm({
            header: 'Desactivar empresa',
            message: `¿Desea desactivar ${company.businessName}? Su historial de evaluaciones se conserva.`,
            icon: 'pi pi-exclamation-triangle',
            acceptLabel: 'Desactivar',
            rejectLabel: 'Cancelar',
            rejectButtonProps: { severity: 'secondary', outlined: true },
            accept: () =>
                this.companyService.deactivate(company.id).subscribe({
                    next: () => {
                        this.toastService.success('Empresa desactivada', company.businessName);
                        this.loadCompanies();
                    },
                    error: () => this.toastService.error('No se pudo desactivar la empresa', 'Intente nuevamente en unos minutos.')
                })
        });
    }
}
