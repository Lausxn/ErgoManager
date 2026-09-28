import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { SelectButtonModule } from 'primeng/selectbutton';
import { TableModule } from 'primeng/table';

import { AuthService } from '../../../core/services/auth.service';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { CompanyResponse } from '../../../shared/models/company.model';
import { HistoryResponse } from '../../../shared/models/history.model';
import { markFormAsDirty } from '../../../shared/utils/form';
import { CompanyService } from '../../companies/company.service';
import { HistoryService } from '../history.service';

type SearchMode = 'company' | 'employee';

/**
 * Screen where the evaluation history of a client company, or of a single
 * employee, is consulted.
 */
@Component({
    selector: 'app-history-list',
    standalone: true,
    imports: [DatePipe, FormsModule, ReactiveFormsModule, ButtonModule, InputNumberModule, InputTextModule, SelectModule, SelectButtonModule, TableModule, PageHeaderComponent],
    templateUrl: './history-list.component.html'
})
export class HistoryListComponent {
    private readonly formBuilder = inject(FormBuilder);

    private readonly historyService = inject(HistoryService);

    private readonly companyService = inject(CompanyService);

    private readonly authService = inject(AuthService);

    /** Only administrators can read the company list, the others type the company number. */
    protected readonly isAdmin = computed(() => this.authService.session()?.role === 'ADMIN');

    protected readonly searchModeOptions = [
        { label: 'Por empresa', value: 'company' },
        { label: 'Por colaborador', value: 'employee' }
    ];

    protected readonly searchMode = signal<SearchMode>('company');

    protected readonly companyList = signal<CompanyResponse[]>([]);

    protected readonly searchForm = this.formBuilder.group({
        companyId: this.formBuilder.control<number | null>(null, [Validators.required, Validators.min(1)]),
        employeeEmail: this.formBuilder.nonNullable.control('', [Validators.required, Validators.email])
    });

    protected readonly historyList = signal<HistoryResponse[]>([]);

    protected readonly hasSearched = signal(false);

    protected readonly isLoading = signal(false);

    constructor() {
        if (this.isAdmin()) {
            this.companyService.findAll().subscribe((companyList) => this.companyList.set(companyList));
        }
    }

    /**
     * Switches between searching by company and by employee.
     *
     * @param mode search mode picked by the user
     */
    protected changeMode(mode: SearchMode): void {
        this.searchMode.set(mode);
        this.historyList.set([]);
        this.hasSearched.set(false);
    }

    /**
     * Reads the history entries of the company or employee typed in the form.
     */
    protected search(): void {
        const field = this.searchMode() === 'company' ? this.searchForm.controls.companyId : this.searchForm.controls.employeeEmail;
        if (field.invalid) {
            markFormAsDirty(field);
            return;
        }

        const { companyId, employeeEmail } = this.searchForm.getRawValue();
        const history$: Observable<HistoryResponse[]> = this.searchMode() === 'company' ? this.historyService.findByCompany(companyId!) : this.historyService.findByEmployee(employeeEmail);

        this.isLoading.set(true);
        history$.subscribe({
            next: (historyList) => {
                this.historyList.set(historyList);
                this.hasSearched.set(true);
                this.isLoading.set(false);
            },
            error: () => {
                this.historyList.set([]);
                this.hasSearched.set(true);
                this.isLoading.set(false);
            }
        });
    }
}
