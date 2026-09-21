import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { Table, TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';

import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { CompanyResponse } from '../../../shared/models/company.model';
import { ACTIVE_TAG_CLASSES } from '../../../shared/utils/labels';
import { CompanyService } from '../company.service';

/**
 * Table of the client companies registered in ErgoManager.
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

    private readonly messageService = inject(MessageService);

    protected readonly companyList = signal<CompanyResponse[]>([]);

    protected readonly isLoading = signal(true);

    protected readonly activeTagClasses = ACTIVE_TAG_CLASSES;

    constructor() {
        this.loadCompanies();
    }

    /**
     * Reads the companies shown by the table.
     */
    protected loadCompanies(): void {
        this.isLoading.set(true);
        this.companyService.findAll().subscribe({
            next: (companyList) => {
                this.companyList.set(companyList);
                this.isLoading.set(false);
            },
            error: () => this.isLoading.set(false)
        });
    }

    /**
     * Filters the table with the text typed in the search box.
     *
     * @param table table to filter
     * @param event input event of the search box
     */
    protected filterTable(table: Table, event: Event): void {
        table.filterGlobal((event.target as HTMLInputElement).value, 'contains');
    }

    /**
     * Asks for confirmation and deactivates the company, keeping its history.
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
                this.companyService.deactivate(company.id).subscribe(() => {
                    this.messageService.add({ severity: 'success', summary: 'Empresa desactivada', detail: company.businessName });
                    this.loadCompanies();
                })
        });
    }
}
