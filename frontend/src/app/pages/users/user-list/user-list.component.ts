import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AvatarModule } from 'primeng/avatar';
import { ButtonModule } from 'primeng/button';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { SelectButtonModule } from 'primeng/selectbutton';
import { SkeletonModule } from 'primeng/skeleton';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';

import { AuthService } from '../../../core/services/auth.service';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { StatCardComponent } from '../../../shared/components/stat-card/stat-card.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { Role } from '../../../shared/models/role.model';
import { UserResponse } from '../../../shared/models/user.model';
import { ToastService } from '../../../shared/services/toast.service';
import { getApiErrorMessage } from '../../../shared/utils/api-error';
import { ACTIVE_TAG_CLASSES, ROLE_LABELS, ROLE_TAG_CLASSES, toEnumOptions } from '../../../shared/utils/labels';
import { UserService } from '../user.service';

type StatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE';

/** Placeholder rows drawn with skeletons while the users load. */
const SKELETON_ROWS = Array.from({ length: 6 }, (_, index) => ({ id: index }));

/** User with the values the table shows, computed once per load instead of on every render. */
interface UserRow extends UserResponse {
    fullName: string;
    initials: string;
    roleLabel: string;
    roleTagClass: string;
    searchKey: string;
    canDeactivate: boolean;
    isCurrentUser: boolean;
}

/**
 * Main dashboard of the user management: summary of the accounts and table of
 * the administrators and ergonomists of ErgoManager.
 */
@Component({
    selector: 'app-user-list',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        DatePipe,
        FormsModule,
        RouterLink,
        AvatarModule,
        ButtonModule,
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
    templateUrl: './user-list.component.html'
})
export class UserListComponent {
    private readonly userService = inject(UserService);

    private readonly router = inject(Router);

    private readonly toastService = inject(ToastService);

    private readonly authService = inject(AuthService);

    private readonly destroyRef = inject(DestroyRef);

    private readonly userList = signal<UserResponse[]>([]);

    protected readonly isLoading = signal(true);

    protected readonly searchText = signal('');

    protected readonly roleFilter = signal<Role | null>(null);

    protected readonly statusFilter = signal<StatusFilter>('ALL');

    protected readonly activeTagClasses = ACTIVE_TAG_CLASSES;

    protected readonly skeletonRows = SKELETON_ROWS;

    protected readonly roleOptions = toEnumOptions(ROLE_LABELS);

    protected readonly statusOptions: { label: string; value: StatusFilter }[] = [
        { label: 'Todos', value: 'ALL' },
        { label: 'Activos', value: 'ACTIVE' },
        { label: 'Inactivos', value: 'INACTIVE' }
    ];

    protected readonly rows = computed<UserRow[]>(() => {
        const currentUserId = this.authService.session()?.userId;
        return this.userList().map((user) => {
            const fullName = [user.firstName, user.firstLastName, user.secondLastName].filter(Boolean).join(' ');
            return {
                ...user,
                fullName,
                initials: `${user.firstName.charAt(0)}${user.firstLastName.charAt(0)}`.toUpperCase(),
                roleLabel: ROLE_LABELS[user.role],
                roleTagClass: ROLE_TAG_CLASSES[user.role],
                searchKey: `${fullName} ${user.email}`.toLowerCase(),
                canDeactivate: user.active && user.id !== currentUserId,
                isCurrentUser: user.id === currentUserId
            };
        });
    });

    /** Figures of the summary cards, counted in a single pass. */
    protected readonly summary = computed(() => {
        const summary = { total: 0, active: 0, admins: 0, ergonomists: 0 };
        for (const user of this.userList()) {
            summary.total++;
            if (user.active) {
                summary.active++;
            }
            if (user.role === 'ADMIN') {
                summary.admins++;
            } else {
                summary.ergonomists++;
            }
        }
        return summary;
    });

    /** Rows left after the search box, the role and the status filters. */
    protected readonly filteredRows = computed(() => {
        const search = this.searchText().trim().toLowerCase();
        const role = this.roleFilter();
        const status = this.statusFilter();
        return this.rows().filter((row) => (role === null || row.role === role) && (status === 'ALL' || row.active === (status === 'ACTIVE')) && (search === '' || row.searchKey.includes(search)));
    });

    constructor() {
        this.loadUsers();
    }

    /**
     * Reads the users shown by the dashboard.
     */
    protected loadUsers(): void {
        this.isLoading.set(true);
        this.userService
            .findAll()
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (userList) => {
                    this.userList.set(userList);
                    this.isLoading.set(false);
                },
                error: () => {
                    this.isLoading.set(false);
                    this.toastService.error('No se pudieron cargar los usuarios', 'Intente de nuevo en unos minutos.');
                }
            });
    }

    /**
     * Opens the page that asks for confirmation before deactivating the user
     * (HU-015). The list reloads when the administrator comes back.
     *
     * @param row user to deactivate
     */
    protected goToDeactivateConfirmation(row: UserRow): void {
        if (!row.canDeactivate) {
            return;
        }
        void this.router.navigate(['/users/deactivate-confirmation'], { queryParams: { id: row.id, name: row.fullName } });
    }

    /**
     * Gives back the access to a deactivated user.
     *
     * @param row user to activate
     */
    protected activate(row: UserRow): void {
        this.userService
            .activate(row.id)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (user) => {
                    this.toastService.success('Usuario reactivado', row.fullName);
                    this.updateUser(row.id, user);
                },
                error: (error: unknown) => this.toastService.error('No se pudo reactivar', getApiErrorMessage(error, 'Intente de nuevo en unos minutos.'))
            });
    }

    /** Applies a change to one user of the list, without reading them all again. */
    private updateUser(id: number, changes: Partial<UserResponse>): void {
        this.userList.update((users) => users.map((user) => (user.id === id ? { ...user, ...changes } : user)));
    }
}
