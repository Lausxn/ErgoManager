import { HttpErrorResponse, HttpStatusCode } from '@angular/common/http';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';

import { AuthService } from '../../../core/services/auth.service';
import { LayoutService } from '../../../layout/service/layout.service';
import { BrandLogoComponent } from '../../../shared/components/brand-logo/brand-logo.component';
import { SidebarNavComponent } from '../../../shared/components/sidebar-nav/sidebar-nav.component';
import { UserResponse } from '../../../shared/models/user.model';
import { ToastService } from '../../../shared/services/toast.service';
import { getApiErrorMessage } from '../../../shared/utils/api-error';
import { ROLE_LABELS } from '../../../shared/utils/labels';
import { UserService } from '../user.service';

const NOT_FOUND_MESSAGE = 'El usuario no existe o ya fue eliminado. Vuelva a la lista e intente de nuevo.';

const DEACTIVATE_ERROR_MESSAGE = 'No se pudo desactivar el usuario. Intente de nuevo más tarde.';

/**
 * Confirms the deactivation (soft delete) of an administrator or ergonomist
 * using the shared security page design. The user is read from the backend,
 * so the page never relies on the name sent in the url and blocks the action
 * when it is not allowed: own account, inactive user or missing user.
 */
@Component({
    selector: 'app-deactivate-user-confirmation',
    standalone: true,
    imports: [ButtonModule, TooltipModule, BrandLogoComponent, SidebarNavComponent],
    templateUrl: './deactivate-user-confirmation.component.html',
    styleUrl: './deactivate-user-confirmation.component.scss'
})
export class DeactivateUserConfirmationComponent {
    private readonly route = inject(ActivatedRoute);
    private readonly router = inject(Router);
    private readonly userService = inject(UserService);
    private readonly toastService = inject(ToastService);
    private readonly destroyRef = inject(DestroyRef);
    protected readonly authService = inject(AuthService);
    protected readonly layoutService = inject(LayoutService);
    protected readonly roleLabels = ROLE_LABELS;

    /** Identifier taken from the url; the rest of the data comes from the backend. */
    protected readonly userId = Number(this.route.snapshot.queryParamMap.get('id'));
    protected readonly hasValidUser = Number.isSafeInteger(this.userId) && this.userId > 0;

    /** User as stored in the backend, null while it loads or when it could not be read. */
    protected readonly user = signal<UserResponse | null>(null);
    protected readonly isLoadingUser = signal(this.hasValidUser);
    protected readonly isDeactivating = signal(false);
    protected readonly errorMessage = signal<string | null>(null);

    /** Name shown in the card: the stored one, or the one of the url while it loads. */
    protected readonly userName = computed(() => {
        const user = this.user();
        if (user !== null) {
            return [user.firstName, user.firstLastName, user.secondLastName].filter(Boolean).join(' ');
        }
        return this.route.snapshot.queryParamMap.get('name')?.trim() || 'Usuario';
    });

    protected readonly isOwnAccount = computed(() => this.user()?.id === this.authService.session()?.userId);

    /** Reason why the account cannot be deactivated, or null when it can. */
    protected readonly blockedReason = computed(() => {
        const user = this.user();
        if (user === null) {
            return null;
        }
        if (this.isOwnAccount()) {
            return 'No puede desactivar su propia cuenta.';
        }
        if (!user.active) {
            return 'Esta cuenta ya está desactivada.';
        }
        return null;
    });

    protected readonly canDeactivate = computed(() => this.user() !== null && this.blockedReason() === null && !this.isDeactivating());
    protected readonly isSidebarCollapsed = computed(() => !!this.layoutService.layoutState().staticMenuDesktopInactive);
    protected readonly isSidebarOpen = computed(() => !!this.layoutService.layoutState().staticMenuMobileActive);

    constructor() {
        if (this.hasValidUser) {
            this.loadUser();
        }
    }

    protected isSidebarVisible(): boolean {
        return this.layoutService.isDesktop() ? !this.isSidebarCollapsed() : this.isSidebarOpen();
    }

    protected closeSidebar(): void {
        this.layoutService.layoutState.update((state) => ({ ...state, staticMenuMobileActive: false }));
    }

    /**
     * Sends the deactivation to the backend. A second click is ignored while
     * the request is running.
     */
    protected deactivateUser(): void {
        if (!this.canDeactivate()) {
            return;
        }
        this.isDeactivating.set(true);
        this.errorMessage.set(null);
        this.userService
            .deactivate(this.userId)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: () => {
                    this.toastService.success('Usuario desactivado', this.userName());
                    void this.router.navigate(['/users']);
                },
                error: (error: unknown) => {
                    this.isDeactivating.set(false);
                    this.errorMessage.set(this.explainError(error, DEACTIVATE_ERROR_MESSAGE));
                }
            });
    }

    protected cancel(): void {
        void this.router.navigate(['/users']);
    }

    /**
     * Reads the selected user, so the page shows its real data and state.
     */
    private loadUser(): void {
        this.userService
            .findById(this.userId)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (user) => {
                    this.user.set(user);
                    this.isLoadingUser.set(false);
                },
                error: (error: unknown) => {
                    this.isLoadingUser.set(false);
                    this.errorMessage.set(this.explainError(error, 'No se pudo cargar el usuario. Intente de nuevo más tarde.'));
                }
            });
    }

    /**
     * Turns a backend error into a message for the administrator. The 404
     * text of the backend is generic, so it is replaced by a clearer one.
     *
     * @param error    error received from the backend
     * @param fallback text used when the backend sent no message
     * @returns message ready to show
     */
    private explainError(error: unknown, fallback: string): string {
        if (error instanceof HttpErrorResponse && error.status === HttpStatusCode.NotFound) {
            return NOT_FOUND_MESSAGE;
        }
        return getApiErrorMessage(error, fallback);
    }
}
