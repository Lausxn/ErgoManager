import { Component, computed, inject } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { TooltipModule } from 'primeng/tooltip';
import { AppPreferences } from './app.preferences';
import { LayoutService } from '../service/layout.service';
import { AuthService } from '../../core/services/auth.service';
import { BrandLogoComponent } from '../../shared/components/brand-logo/brand-logo.component';
import { ROLE_LABELS } from '../../shared/utils/labels';

@Component({
    selector: 'app-topbar',
    standalone: true,
    imports: [RouterModule, CommonModule, TooltipModule, AppPreferences, BrandLogoComponent],
    template: ` <div class="layout-topbar">
        <div class="layout-topbar-logo-container">
            <button class="layout-menu-button layout-topbar-action" (click)="layoutService.onMenuToggle()" aria-label="Mostrar u ocultar el menú">
                <i class="pi pi-bars"></i>
            </button>
            <a class="layout-topbar-logo" routerLink="/" aria-label="Ir al inicio">
                <app-brand-logo class="layout-topbar-logo-full" variant="full" />
                <app-brand-logo class="layout-topbar-logo-symbol" variant="symbol" />
            </a>
        </div>

        <div class="layout-topbar-actions">
            @if (isPreview()) {
                <a routerLink="/auth/login" class="mgs-preview-badge" pTooltip="Modo temporal sin guards. Desactívelo en environment.development.ts" tooltipPosition="bottom">Vista previa · Iniciar sesión</a>
            }
            @if (session(); as currentSession) {
                <div class="layout-topbar-user">
                    <span class="layout-topbar-user-name">{{ currentSession.fullName }}</span>
                    <span class="layout-topbar-user-role">{{ roleLabel() }}</span>
                </div>
            }

            <div class="layout-config-menu">
                <app-preferences />
                <button type="button" class="layout-topbar-action" (click)="logout()" pTooltip="Cerrar sesión" tooltipPosition="bottom" aria-label="Cerrar sesión">
                    <i class="pi pi-sign-out"></i>
                </button>
            </div>
        </div>
    </div>`
})
export class AppTopbar {
    protected readonly layoutService = inject(LayoutService);

    private readonly authService = inject(AuthService);

    private readonly router = inject(Router);

    protected readonly session = this.authService.session;

    protected readonly isPreview = computed(() => this.authService.isPreviewMode && !this.session()?.token);

    protected readonly roleLabel = computed(() => {
        const role = this.session()?.role;
        return role ? ROLE_LABELS[role] : '';
    });

    /**
     * Clears the session and sends the user back to the login page.
     */
    protected logout(): void {
        this.authService.logout();
        void this.router.navigate(['/auth/login']);
    }
}
