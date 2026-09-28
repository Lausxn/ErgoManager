import { CommonModule } from '@angular/common';
import { Component, Renderer2, ViewChild, computed, inject } from '@angular/core';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { filter, Subscription } from 'rxjs';

import { AuthService } from '../../core/services/auth.service';
import { PasswordUpdatePopupComponent } from '../../pages/auth/password-update-popup/password-update-popup.component';
import { UPDATE_PASSWORD_URL } from '../../pages/account/account.routes';
import { AppFooter } from './app.footer';
import { AppSidebar } from './app.sidebar';
import { AppTopbar } from './app.topbar';
import { LayoutService } from '../service/layout.service';

@Component({
    selector: 'app-layout',
    standalone: true,
    imports: [
        CommonModule,
        AppTopbar,
        AppSidebar,
        RouterModule,
        AppFooter,
        PasswordUpdatePopupComponent
    ],
    template: `
        <div class="layout-wrapper" [ngClass]="containerClass">
            <app-topbar></app-topbar>
            <app-sidebar></app-sidebar>

            <div class="layout-main-container">
                <div class="layout-main">
                    <router-outlet></router-outlet>
                </div>

                <app-footer></app-footer>
            </div>

            <div class="layout-mask animate-fadein"></div>
        </div>

        <app-password-update-popup
            [visible]="showPasswordUpdatePopup()"
            (closed)="closePasswordUpdatePopup()"
            (updateRequested)="openPasswordUpdatePage()"
        />
    `
})
export class AppLayout {

    private readonly authService = inject(AuthService);

    overlayMenuOpenSubscription: Subscription;

    menuOutsideClickListener: any;

    @ViewChild(AppSidebar)
    appSidebar!: AppSidebar;

    @ViewChild(AppTopbar)
    appTopBar!: AppTopbar;

    /**
     * Indicates whether the temporary-password reminder must be displayed.
     */
    protected readonly showPasswordUpdatePopup = computed(
        () => this.authService.session()?.mustChangePassword === true
    );

    constructor(
        public layoutService: LayoutService,
        public renderer: Renderer2,
        public router: Router
    ) {
        this.overlayMenuOpenSubscription =
            this.layoutService.overlayOpen$.subscribe(() => {

                if (!this.menuOutsideClickListener) {
                    this.menuOutsideClickListener =
                        this.renderer.listen(
                            'document',
                            'click',
                            (event) => {

                                if (this.isOutsideClicked(event)) {
                                    this.hideMenu();
                                }
                            }
                        );
                }

                if (
                    this.layoutService
                        .layoutState()
                        .staticMenuMobileActive
                ) {
                    this.blockBodyScroll();
                }
            });

        this.router.events
            .pipe(
                filter(
                    (event) =>
                        event instanceof NavigationEnd
                )
            )
            .subscribe(() => {
                this.hideMenu();
            });
    }

    /**
     * Closes the temporary-password reminder for the current visit.
     *
     * The session still keeps mustChangePassword=true, so the reminder will
     * appear again after the next sign in until the password is changed.
     */
    protected closePasswordUpdatePopup(): void {
        const session = this.authService.session();

        if (session === null) {
            return;
        }

        this.authService.dismissPasswordReminder();
    }

    /**
     * Opens the page where the authenticated user can replace the temporary
     * password.
     */
    protected openPasswordUpdatePage(): void {
        this.authService.dismissPasswordReminder();
        void this.router.navigateByUrl(
            UPDATE_PASSWORD_URL
        );
    }

    isOutsideClicked(event: MouseEvent) {
        const sidebarEl =
            document.querySelector('.layout-sidebar');

        const topbarEl =
            document.querySelector('.layout-menu-button');

        const eventTarget = event.target as Node;

        return !(
            sidebarEl?.isSameNode(eventTarget)
            || sidebarEl?.contains(eventTarget)
            || topbarEl?.isSameNode(eventTarget)
            || topbarEl?.contains(eventTarget)
        );
    }

    hideMenu() {
        this.layoutService.layoutState.update(
            (prev) => ({
                ...prev,
                overlayMenuActive: false,
                staticMenuMobileActive: false,
                menuHoverActive: false
            })
        );

        if (this.menuOutsideClickListener) {
            this.menuOutsideClickListener();
            this.menuOutsideClickListener = null;
        }

        this.unblockBodyScroll();
    }

    blockBodyScroll(): void {
        if (document.body.classList) {
            document.body.classList.add(
                'blocked-scroll'
            );
        } else {
            document.body.className +=
                ' blocked-scroll';
        }
    }

    unblockBodyScroll(): void {
        if (document.body.classList) {
            document.body.classList.remove(
                'blocked-scroll'
            );
        } else {
            document.body.className =
                document.body.className.replace(
                    new RegExp(
                        '(^|\\b)'
                        + 'blocked-scroll'
                            .split(' ')
                            .join('|')
                        + '(\\b|$)',
                        'gi'
                    ),
                    ' '
                );
        }
    }

    get containerClass() {
        return {
            'layout-overlay':
                this.layoutService
                    .layoutConfig()
                    .menuMode === 'overlay',

            'layout-static':
                this.layoutService
                    .layoutConfig()
                    .menuMode === 'static',

            'layout-static-inactive':
                this.layoutService
                    .layoutState()
                    .staticMenuDesktopInactive
                && this.layoutService
                    .layoutConfig()
                    .menuMode === 'static',

            'layout-overlay-active':
                this.layoutService
                    .layoutState()
                    .overlayMenuActive,

            'layout-mobile-active':
                this.layoutService
                    .layoutState()
                    .staticMenuMobileActive
        };
    }

    ngOnDestroy() {
        if (this.overlayMenuOpenSubscription) {
            this.overlayMenuOpenSubscription.unsubscribe();
        }

        if (this.menuOutsideClickListener) {
            this.menuOutsideClickListener();
        }
    }
}