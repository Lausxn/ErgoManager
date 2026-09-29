import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ConfirmationService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';

import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { FormResponse } from '../../../shared/models/form.model';
import { ToastService } from '../../../shared/services/toast.service';
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

    private readonly toastService = inject(ToastService);

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
            error: () => {
                this.isLoading.set(false);
                this.toastService.error('No se pudieron cargar los formularios', 'Verifique la conexión e intente nuevamente.');
            }
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
            rejectButtonProps: {
                severity: 'secondary',
                outlined: true
            },
            accept: () =>
                this.formService.deactivate(form.id).subscribe({
                    next: () => {
                        this.toastService.success('Formulario desactivado', form.title);
                        this.loadForms();
                    },
                    error: () => this.toastService.error('No se pudo desactivar el formulario', 'Intente nuevamente en unos minutos.')
                })
        });
    }
}
