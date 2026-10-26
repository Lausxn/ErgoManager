import { Component, computed, inject } from '@angular/core';
import { IsActiveMatchOptions } from '@angular/router';
import { MenuItem } from 'primeng/api';

import { AuthService } from '../../core/services/auth.service';
import { AppMenuitemComponent } from './app.menuitem';

/** Keeps an entry highlighted on every screen of its section, not only on its first one. */
const SECTION_ACTIVE: IsActiveMatchOptions = { paths: 'subset', queryParams: 'ignored', matrixParams: 'ignored', fragment: 'ignored' };

/**
 * Side menu of ErgoManager. Every entry is shown only to the roles that the
 * guards of its route let through.
 */
@Component({
    selector: 'app-menu',
    imports: [AppMenuitemComponent],
    template: `<ul class="layout-menu">
        @for (item of model(); track item.label) {
            <li app-menuitem [item]="item" [root]="true"></li>
        }
    </ul>`
})
export class AppMenuComponent {
    private readonly authService = inject(AuthService);

    protected readonly model = computed<MenuItem[]>(() => {
        const isAdmin = this.authService.session()?.role === 'ADMIN';

        // Sections follow the order of the work, the same for both roles: prepare the
        // client and its forms, attend the appointments, then follow the results.
        return [
            {
                label: 'Preparación',
                items: [
                    { label: 'Empresas', icon: 'fa-solid fa-building fa-fw', routerLink: ['/companies'], routerLinkActiveOptions: SECTION_ACTIVE },
                    { label: 'Formularios', icon: 'fa-solid fa-file-pen fa-fw', routerLink: ['/forms'], routerLinkActiveOptions: SECTION_ACTIVE }
                ]
            },
            {
                label: 'Atención',
                items: [
                    { label: 'Citas', icon: 'fa-regular fa-calendar-days fa-fw', routerLink: ['/appointments'], routerLinkActiveOptions: SECTION_ACTIVE },
                    { label: 'Evaluación personalizada', icon: 'fa-solid fa-clipboard-user fa-fw', routerLink: ['/personalized-evaluations'] }
                ]
            },
            {
                label: 'Seguimiento',
                items: [{ label: 'Historial', icon: 'fa-solid fa-chart-line fa-fw', routerLink: ['/history'] }]
            },
            {
                // User management stays restricted to administrators.
                label: 'Administración',
                visible: isAdmin,
                items: [{ label: 'Usuarios', icon: 'fa-solid fa-users fa-fw', routerLink: ['/users'], routerLinkActiveOptions: SECTION_ACTIVE }]
            },
            {
                // Shortcuts kept while the application is being developed.
                label: 'Temporal',
                items: [
                    { label: 'Autoevaluación pública', icon: 'fa-solid fa-arrow-up-right-from-square fa-fw', url: '/self-evaluation', target: '_blank' },
                    { label: 'Cambiar contraseña', icon: 'fa-solid fa-key fa-fw', routerLink: ['/account/password'] }
                ]
            }
        ];
    });
}
