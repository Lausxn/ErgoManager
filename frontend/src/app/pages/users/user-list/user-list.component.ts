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

import { AuthService } from '../../../core/services/auth.service';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { UserResponse } from '../../../shared/models/user.model';
import { ACTIVE_TAG_CLASSES, ROLE_LABELS } from '../../../shared/utils/labels';
import { UserService } from '../user.service';

/**
 * Table of the administrators and ergonomists of ErgoManager.
 */
@Component({
    selector: 'app-user-list',
    standalone: true,
    imports: [RouterLink, ButtonModule, IconFieldModule, InputIconModule, InputTextModule, TableModule, TagModule, TooltipModule, PageHeaderComponent],
    templateUrl: './user-list.component.html'
})
export class UserListComponent {
    private readonly userService = inject(UserService);

    private readonly confirmationService = inject(ConfirmationService);

    private readonly messageService = inject(MessageService);

    private readonly authService = inject(AuthService);

    protected readonly userList = signal<UserResponse[]>([]);

    protected readonly isLoading = signal(true);

    protected readonly roleLabels: Record<string, string> = ROLE_LABELS;

    protected readonly activeTagClasses = ACTIVE_TAG_CLASSES;

    constructor() {
        this.loadUsers();
    }

    /**
     * Reads the users shown by the table.
     */
    protected loadUsers(): void {
        this.isLoading.set(true);
        this.userService.findAll().subscribe({
            next: (userList) => {
                this.userList.set(userList);
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
     * Checks whether the row belongs to the signed in user, who cannot
     * deactivate their own account.
     *
     * @param user row of the table
     * @returns true for the signed in user
     */
    protected isCurrentUser(user: UserResponse): boolean {
        return this.authService.session()?.userId === user.id;
    }

    /**
     * Asks for confirmation and deactivates the user, who can no longer sign in.
     *
     * @param user user to deactivate
     */
    protected confirmDeactivate(user: UserResponse): void {
        const fullName = `${user.firstName} ${user.firstLastName}`;
        this.confirmationService.confirm({
            header: 'Desactivar usuario',
            message: `¿Desea desactivar a ${fullName}? Ya no podrá iniciar sesión.`,
            icon: 'pi pi-exclamation-triangle',
            acceptLabel: 'Desactivar',
            rejectLabel: 'Cancelar',
            rejectButtonProps: { severity: 'secondary', outlined: true },
            accept: () =>
                this.userService.deactivate(user.id).subscribe(() => {
                    this.messageService.add({ severity: 'success', summary: 'Usuario desactivado', detail: fullName });
                    this.loadUsers();
                })
        });
    }
}
