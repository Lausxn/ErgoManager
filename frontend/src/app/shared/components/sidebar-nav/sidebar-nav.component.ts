import { Component, computed } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

import { Role } from '../../models/role.model';
import { ROLE_LABELS } from '../../utils/labels';
import { BrandLogoComponent } from '../brand-logo/brand-logo.component';

/** Option of the side navigation. */
interface SidebarItem {
    label: string;
    icon: string;
    route: string;
    /** True when only the exact url marks the option as active. */
    exact?: boolean;
}

/** Profile shown at the bottom of the navigation. */
interface SidebarUser {
    fullName: string;
    role: Role;
}

/**
 * TEMPORARY: fixed profile until the users feature is connected. Replace it
 * with the session of AuthService (fullName and role) when the backend is ready.
 */
const PLACEHOLDER_USER: SidebarUser = { fullName: 'Keisy Sibaja', role: 'ERGONOMIST' };

/** Options of the ergonomist, in the order of the mockup. */
const ERGONOMIST_ITEMS: readonly SidebarItem[] = [
    { label: 'Inicio', icon: 'pi pi-th-large', route: '/', exact: true },
    { label: 'Formularios', icon: 'pi pi-file', route: '/forms' },
    { label: 'Citas', icon: 'pi pi-calendar', route: '/appointments' },
    { label: 'Perfiles de clientes', icon: 'pi pi-building', route: '/companies' },
    { label: 'Reportes', icon: 'pi pi-chart-bar', route: '/history' }
];

/**
 * Dark side navigation of ErgoManager: white logo, the options of the role and
 * the signed in user at the bottom. It keeps the "Negro" surface of the brand
 * book in both themes, like the sign in impact panel.
 */
@Component({
    selector: 'app-sidebar-nav',
    standalone: true,
    imports: [RouterLink, RouterLinkActive, BrandLogoComponent],
    template: `
        <div class="mgs-sidenav__brand">
            <app-brand-logo variant="full" tone="white" />
            <span class="mgs-sidenav__product">MGS Ergo Manager</span>
        </div>

        <nav class="mgs-sidenav__nav" aria-label="Navegación principal">
            <span class="mgs-sidenav__section">{{ roleLabel() }}</span>
            <ul class="mgs-sidenav__list">
                @for (item of items; track item.route) {
                    <li>
                        <a class="mgs-sidenav__link" [routerLink]="item.route" routerLinkActive="is-active" [routerLinkActiveOptions]="{ exact: item.exact ?? false }" ariaCurrentWhenActive="page">
                            <i [class]="item.icon" aria-hidden="true"></i>
                            <span>{{ item.label }}</span>
                        </a>
                    </li>
                }
            </ul>
        </nav>

        <div class="mgs-sidenav__user">
            <span class="mgs-sidenav__avatar" aria-hidden="true">{{ initials() }}</span>
            <div class="mgs-sidenav__user-text">
                <strong>{{ user.fullName }}</strong>
                <span>{{ roleLabel() }}</span>
            </div>
        </div>
    `,
    host: { class: 'mgs-sidenav' }
})
export class SidebarNavComponent {
    protected readonly user = PLACEHOLDER_USER;

    protected readonly items = ERGONOMIST_ITEMS;

    protected readonly roleLabel = computed(() => ROLE_LABELS[this.user.role]);

    /** First letter of the first two words of the name, as in the mockup ("KS"). */
    protected readonly initials = computed(() =>
        this.user.fullName
            .split(/\s+/)
            .slice(0, 2)
            .map((word) => word.charAt(0).toUpperCase())
            .join('')
    );
}
