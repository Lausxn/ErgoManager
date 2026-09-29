import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MenuItem } from 'primeng/api';
import { AppMenuitem } from './app.menuitem';
import { AuthService } from '../../core/services/auth.service';

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
        const isErgonomist = isPreview || this.authService.session()?.role === 'ERGONOMIST';

        return [
            {
                label: 'Administración',
                visible: isAdmin,
                items: [
                    { label: 'Empresas', icon: 'fa-solid fa-building fa-fw', routerLink: ['/companies'] },
                    { label: 'Usuarios', icon: 'fa-solid fa-users fa-fw', routerLink: ['/users'] },
                    { label: 'Formularios', icon: 'fa-solid fa-file-pen fa-fw', routerLink: ['/forms'] }
                ]
            },
            {
                label: 'Evaluación',
                items: [
                    { label: 'Agenda', icon: 'fa-regular fa-calendar-days fa-fw', routerLink: ['/appointments'] },
                    { label: 'Evaluación personalizada', icon: 'fa-solid fa-clipboard-user fa-fw', routerLink: ['/personalized-evaluations'], visible: isErgonomist },
                    { label: 'Historial', icon: 'fa-solid fa-chart-line fa-fw', routerLink: ['/history'] }
                ]
            },
            {
                label: 'Empleados',
                items: [{ label: 'Autoevaluación pública', icon: 'fa-solid fa-arrow-up-right-from-square fa-fw', url: '/self-evaluation', target: '_blank' }]
            },
            {
                label: 'Cuenta',
                items: [{ label: 'Cambiar contraseña', icon: 'fa-solid fa-key fa-fw', routerLink: ['/account/password'] }]
            }
        ];
    });
}
