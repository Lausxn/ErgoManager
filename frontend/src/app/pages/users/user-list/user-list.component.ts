import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { AvatarModule } from 'primeng/avatar';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { DividerModule } from 'primeng/divider';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { SelectButtonModule } from 'primeng/selectbutton';
import { SkeletonModule } from 'primeng/skeleton';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ToolbarModule } from 'primeng/toolbar';
import { TooltipModule } from 'primeng/tooltip';

import { AuthService } from '../../../core/services/auth.service';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { Role } from '../../../shared/models/role.model';
import { UserResponse } from '../../../shared/models/user.model';
import { ACTIVE_TAG_CLASSES, EnumOption, ROLE_LABELS, toEnumOptions } from '../../../shared/utils/labels';
import { UserService } from '../user.service';

type StatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE';

/** Summary card shown above the table. */
interface UserStat {
    label: string;
    value: number;
    icon: string;
}

/**
 * Main dashboard of the user management: summary of the accounts, table of
 * the administrators and ergonomists, and the entry to create a new user.
 */
@Component({
    selector: 'app-user-list',
    standalone: true,
    imports: [
        DatePipe,
        FormsModule,
        RouterLink,
        AvatarModule,
        ButtonModule,
        CardModule,
        DividerModule,
        IconFieldModule,
        InputIconModule,
        InputTextModule,
        SelectButtonModule,
        SkeletonModule,
        TableModule,
        TagModule,
        ToolbarModule,
        TooltipModule,
        PageHeaderComponent
    ],
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

    protected readonly roleFilterOptions: EnumOption<Role | 'ALL'>[] = [{ label: 'Todos', value: 'ALL' }, ...toEnumOptions(ROLE_LABELS)];

    protected readonly statusFilterOptions: EnumOption<StatusFilter>[] = [
        { label: 'Todos', value: 'ALL' },
        { label: 'Activos', value: 'ACTIVE' },
        { label: 'Inactivos', value: 'INACTIVE' }
    ];

    protected readonly searchText = signal('');

    protected readonly roleFilter = signal<Role | 'ALL'>('ALL');

    protected readonly statusFilter = signal<StatusFilter>('ALL');

    protected readonly statList = computed<UserStat[]>(() => {
        const userList = this.userList();
        return [
            { label: 'Usuarios registrados', value: userList.length, icon: 'pi pi-users' },
            { label: 'Activos', value: userList.filter((user) => user.active).length, icon: 'pi pi-check-circle' },
            { label: 'Administradores', value: userList.filter((user) => user.role === 'ADMIN').length, icon: 'pi pi-shield' },
            { label: 'Ergonomistas', value: userList.filter((user) => user.role === 'ERGONOMIST').length, icon: 'pi pi-heart' }
        ];
    });

    protected readonly filteredUserList = computed(() => {
        const search = this.normalize(this.searchText());
        const role = this.roleFilter();
        const status = this.statusFilter();
        return this.userList().filter(
            (user) =>
                (role === 'ALL' || user.role === role) &&
                (status === 'ALL' || user.active === (status === 'ACTIVE')) &&
                (search === '' || this.normalize(`${this.fullName(user)} ${user.email}`).includes(search))
        );
    });

    constructor() {
        this.loadUsers();
    }

    /**
     * Reads the users shown by the dashboard.
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
     * Stores the text typed in the search box.
     *
     * @param event input event of the search box
     */
    protected search(event: Event): void {
        this.searchText.set((event.target as HTMLInputElement).value);
    }

    /**
     * Clears the search and both filters.
     */
    protected clearFilters(): void {
        this.searchText.set('');
        this.roleFilter.set('ALL');
        this.statusFilter.set('ALL');
    }

    /**
     * Builds the full name of a user.
     *
     * @param user row of the table
     * @returns name and surnames separated by spaces
     */
    protected fullName(user: UserResponse): string {
        return [user.firstName, user.firstLastName, user.secondLastName].filter(Boolean).join(' ');
    }

    /**
     * Initials shown in the avatar of a row.
     *
     * @param user row of the table
     * @returns first letter of the name and of the first surname
     */
    protected initials(user: UserResponse): string {
        return `${user.firstName.charAt(0)}${user.firstLastName.charAt(0)}`.toUpperCase();
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

    /**
     * Lowercases a text and removes its accents, so "Jose" finds "José".
     *
     * @param text text to normalize
     * @returns the normalized text
     */
    private normalize(text: string): string {
        return text
            .normalize('NFD')
            .replace(/[̀-ͯ]/g, '')
            .toLowerCase()
            .trim();
    }
}
