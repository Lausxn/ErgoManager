import { Component, DestroyRef, Renderer2, computed, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';

import { AuthService } from '../../core/services/auth.service';
import { InactivityService } from '../../core/services/inactivity.service';
import { UPDATE_PASSWORD_URL } from '../../pages/account/account.routes';
import { PasswordUpdatePopupComponent } from '../../pages/auth/password-update-popup/password-update-popup.component';
import { LayoutService } from '../service/layout.service';
import { AppFooterComponent } from './app.footer';
import { AppSidebarComponent } from './app.sidebar';
import { AppTopbarComponent } from './app.topbar';

/**
 * Frame of every page of a signed in user: top bar, side menu, content and
 * footer, plus the reminder to replace a temporary password.
 */
@Component({
    selector: 'app-layout',
    imports: [RouterOutlet, AppTopbarComponent, AppSidebarComponent, AppFooterComponent, PasswordUpdatePopupComponent],
    template: `<div class="layout-wrapper" [class]="containerClass()">
            <app-topbar />
            <app-sidebar />
            <div class="layout-main-container">
                <div class="layout-main">
                    <router-outlet />
                </div>
                <app-footer />
            </div>
            <div class="layout-mask animate-fadein"></div>
        </div>

        <app-password-update-popup [visible]="showPasswordUpdatePopup()" (closed)="closePasswordUpdatePopup()" (updateRequested)="openPasswordUpdatePage()" />`
})
export class AppLayoutComponent {
    private readonly layoutService = inject(LayoutService);
    private readonly renderer = inject(Renderer2);
    private readonly router = inject(Router);
    private readonly authService = inject(AuthService);
    private readonly inactivityService = inject(InactivityService);

    /** Removes the document click listener that closes the open menu, while there is one. */
    private removeOutsideClickListener: (() => void) | null = null;

    protected readonly containerClass = computed(() => {
        const { menuMode } = this.layoutService.layoutConfig();
        const state = this.layoutService.layoutState();
        return {
            'layout-wrapper': true,
            'layout-overlay': menuMode === 'overlay',
            'layout-static': menuMode === 'static',
            'layout-static-inactive': !!state.staticMenuDesktopInactive && menuMode === 'static',
            'layout-overlay-active': !!state.overlayMenuActive,
            'layout-mobile-active': !!state.staticMenuMobileActive
        };
    });

    constructor() {
        // The layout only exists while somebody is signed in.
        this.inactivityService.start();

        this.layoutService.overlayOpen$.pipe(takeUntilDestroyed()).subscribe(() => {
            this.removeOutsideClickListener ??= this.renderer.listen('document', 'click', (event: MouseEvent) => {
                if (this.isOutsideClicked(event)) {
                    this.hideMenu();
                }
            });
            if (this.layoutService.layoutState().staticMenuMobileActive) {
                document.body.classList.add('blocked-scroll');
            }
        });

        this.router.events
            .pipe(
                filter((event) => event instanceof NavigationEnd),
                takeUntilDestroyed()
            )
            .subscribe(() => this.hideMenu());

        inject(DestroyRef).onDestroy(() => {
            this.inactivityService.stop();
            this.removeOutsideClickListener?.();
        });
    }

    /**
     * Checks whether the temporary-password reminder has to be displayed.
     *
     * @returns true when the signed in user still has a temporary password
     */
    protected showPasswordUpdatePopup(): boolean {
        return this.authService.session()?.mustChangePassword === true;
    }

    /** Closes the temporary-password reminder for the current visit. */
    protected closePasswordUpdatePopup(): void {
        this.authService.dismissPasswordReminder();
    }

    /** Opens the page where the user replaces the temporary password. */
    protected openPasswordUpdatePage(): void {
        this.authService.dismissPasswordReminder();
        void this.router.navigateByUrl(UPDATE_PASSWORD_URL);
    }

    /**
     * Tells whether a click happened outside the side menu and its toggle button.
     *
     * @param event click on the document
     * @returns true when the open menu has to close
     */
    private isOutsideClicked(event: MouseEvent): boolean {
        const target = event.target as Node;
        const sidebar = document.querySelector('.layout-sidebar');
        const toggle = document.querySelector('.layout-menu-button');
        return !(sidebar?.contains(target) || toggle?.contains(target));
    }

    /** Closes the overlay or mobile menu and lets the page scroll again. */
    private hideMenu(): void {
        this.layoutService.layoutState.update((state) => ({ ...state, overlayMenuActive: false, staticMenuMobileActive: false }));
        this.removeOutsideClickListener?.();
        this.removeOutsideClickListener = null;
        document.body.classList.remove('blocked-scroll');
    }
}
