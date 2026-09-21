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
                    { label: 'Empresas', icon: 'pi pi-fw pi-building', routerLink: ['/companies'] },
                    { label: 'Usuarios', icon: 'pi pi-fw pi-users', routerLink: ['/users'] },
                    { label: 'Formularios', icon: 'pi pi-fw pi-file-edit', routerLink: ['/forms'] }
                ]
            },
            {
                label: 'Evaluación',
                items: [
                    { label: 'Agenda', icon: 'pi pi-fw pi-calendar', routerLink: ['/appointments'] },
                    { label: 'Evaluación personalizada', icon: 'pi pi-fw pi-clipboard', routerLink: ['/personalized-evaluations'], visible: isErgonomist },
                    { label: 'Historial', icon: 'pi pi-fw pi-history', routerLink: ['/history'] }
                ]
            },
            {
                label: 'Empleados',
                items: [{ label: 'Autoevaluación pública', icon: 'pi pi-fw pi-external-link', url: '/self-evaluation', target: '_blank' }]
            }
        ];
    });
}
