import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IsActiveMatchOptions, RouterModule } from '@angular/router';
import { MenuItem } from 'primeng/api';
import { AppMenuitem } from './app.menuitem';
import { AuthService } from '../../core/services/auth.service';

/** Keeps an entry highlighted on every screen of its section, not only on its first one. */
const SECTION_ACTIVE: IsActiveMatchOptions = { paths: 'subset', queryParams: 'ignored', matrixParams: 'ignored', fragment: 'ignored' };

/**
 * Side menu of ErgoManager. Every entry is shown only to the roles that the
 * guards of its route let through.
 */
@Component({
    selector: 'app-menu',
    standalone: true,
    imports: [CommonModule, AppMenuitem, RouterModule],
    template: `<ul class="layout-menu">
        <ng-container *ngFor="let item of model(); let i = index">
            <li app-menuitem *ngIf="!item.separator" [item]="item" [index]="i" [root]="true"></li>
            <li *ngIf="item.separator" class="menu-separator"></li>
        </ng-container>
    </ul> `
})
export class AppMenu {
    private readonly authService = inject(AuthService);

    protected readonly model = computed<MenuItem[]>(() => {
        const isPreview = this.authService.isPreviewMode && !this.authService.getToken();
        const isAdmin = isPreview || this.authService.session()?.role === 'ADMIN';

        // Sections follow the order of the work, the same for both roles: prepare the
        // client and its forms, attend the appointments, then follow the results.
        return [
            {
                label: 'Preparación',
                items: [
                    { label: 'Empresas', icon: 'fa-solid fa-building fa-fw', routerLink: ['/companies'] },
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
                items: [{ label: 'Usuarios', icon: 'fa-solid fa-users fa-fw', routerLink: ['/users'] }]
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
