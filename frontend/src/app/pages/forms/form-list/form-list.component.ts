import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';

import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { FormResponse } from '../../../shared/models/form.model';
import { ACTIVE_TAG_CLASSES } from '../../../shared/utils/labels';
import { FormService } from '../form.service';

/**
 * Table of the self evaluation forms, where the administrator can deactivate
 * the ones that are no longer in use.
 */
@Component({
    selector: 'app-form-list',
    standalone: true,
    imports: [RouterLink, ButtonModule, TableModule, TagModule, TooltipModule, PageHeaderComponent],
    templateUrl: './form-list.component.html'
})
export class FormListComponent {
    private readonly formService = inject(FormService);

    private readonly confirmationService = inject(ConfirmationService);

    private readonly messageService = inject(MessageService);

    protected readonly formList = signal<FormResponse[]>([]);

    protected readonly isLoading = signal(true);

    protected readonly activeTagClasses = ACTIVE_TAG_CLASSES;

    constructor() {
        this.loadForms();
    }

    /**
     * Reads the forms shown by the table.
     */
    protected loadForms(): void {
        this.isLoading.set(true);
        this.formService.findAll().subscribe({
            next: (formList) => {
                this.formList.set(formList);
                this.isLoading.set(false);
            },
            error: () => this.isLoading.set(false)
        });
    }

    /**
     * Asks for confirmation and deactivates a form, so it is no longer offered
     * to the employees.
     *
     * @param form form to deactivate
     */
    protected confirmDeactivate(form: FormResponse): void {
        this.confirmationService.confirm({
            header: 'Desactivar formulario',
            message: `¿Desea desactivar "${form.title}"? Los colaboradores ya no podrán responderlo.`,
            icon: 'pi pi-exclamation-triangle',
            acceptLabel: 'Desactivar',
            rejectLabel: 'Cancelar',
            rejectButtonProps: { severity: 'secondary', outlined: true },
            accept: () =>
                this.formService.deactivate(form.id).subscribe(() => {
                    this.messageService.add({ severity: 'success', summary: 'Formulario desactivado', detail: form.title });
                    this.loadForms();
                })
        });
    }
}
