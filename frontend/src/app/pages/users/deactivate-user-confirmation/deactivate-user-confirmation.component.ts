import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';

import { AuthService } from '../../../core/services/auth.service';
import { LayoutService } from '../../../layout/service/layout.service';
import { BrandLogoComponent } from '../../../shared/components/brand-logo/brand-logo.component';
import { SidebarNavComponent } from '../../../shared/components/sidebar-nav/sidebar-nav.component';
import { getApiErrorMessage } from '../../../shared/utils/api-error';
import { UserService } from '../user.service';

/** Confirms account deactivation using the shared security page design. */
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
    private readonly messageService = inject(MessageService);
    protected readonly authService = inject(AuthService);
    protected readonly layoutService = inject(LayoutService);

    protected readonly userId = Number(this.route.snapshot.queryParamMap.get('id'));
    protected readonly userName = this.route.snapshot.queryParamMap.get('name')?.trim() || 'Usuario';
    protected readonly hasValidUser = Number.isSafeInteger(this.userId) && this.userId > 0;
    protected isLoading = false;
    protected errorMessage: string | null = null;
    protected readonly isSidebarCollapsed = computed(() => !!this.layoutService.layoutState().staticMenuDesktopInactive);
    protected readonly isSidebarOpen = computed(() => !!this.layoutService.layoutState().staticMenuMobileActive);

    protected isSidebarVisible(): boolean {
        return this.layoutService.isDesktop() ? !this.isSidebarCollapsed() : this.isSidebarOpen();
    }

    protected closeSidebar(): void {
        this.layoutService.layoutState.update((state) => ({ ...state, staticMenuMobileActive: false }));
    }

    /** Keeps the existing API contract and prevents repeated submissions. */
    protected deactivateUser(): void {
        if (!this.hasValidUser || this.isLoading) return;
        this.isLoading = true;
        this.errorMessage = null;
        this.userService.deactivate(this.userId).subscribe({
            next: () => {
                this.messageService.add({ severity: 'success', summary: 'Usuario desactivado', detail: this.userName });
                void this.router.navigate(['/users']);
            },
            error: (error: unknown) => {
                this.isLoading = false;
                this.errorMessage = getApiErrorMessage(error, 'No se pudo desactivar el usuario. Intente de nuevo más tarde.');
            }
        });
    }

    protected cancel(): void {
        void this.router.navigate(['/users']);
    }
}
