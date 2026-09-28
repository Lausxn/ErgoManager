import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { MenuItem } from 'primeng/api';

import { AuthService } from '../../core/services/auth.service';
import { AppMenuitem } from './app.menuitem';

/** Side menu of ErgoManager. The visible options depend on the signed-in role. */
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
        const role = this.authService.session()?.role ?? 'ERGONOMIST';
        const isAdmin = role === 'ADMIN';

        const roleSection: MenuItem = isAdmin
            ? {
                  label: 'Administración',
                  items: [
                      { label: 'Empresas', icon: 'pi pi-fw pi-building', routerLink: ['/companies'] },
                      { label: 'Usuarios', icon: 'pi pi-fw pi-users', routerLink: ['/users'] },
                      { label: 'Formularios', icon: 'pi pi-fw pi-file-edit', routerLink: ['/forms'] }
                  ]
              }
            : {
                  label: 'Ergonomía',
                  items: [
                      { label: 'Formularios', icon: 'pi pi-fw pi-file-edit', routerLink: ['/forms'] },
                      { label: 'Agenda de citas', icon: 'pi pi-fw pi-calendar', routerLink: ['/appointments'] },
                      { label: 'Perfiles de clientes', icon: 'pi pi-fw pi-building', routerLink: ['/companies'] },
                      { label: 'Reportes', icon: 'pi pi-fw pi-chart-bar', routerLink: ['/history'] }
                  ]
              };

        return [
            { label: 'Inicio', items: [{ label: 'Inicio', icon: 'pi pi-fw pi-home', routerLink: ['/dashboard'] }] },
            roleSection,
            { label: 'Cuenta', items: [{ label: 'Cambiar contraseña', icon: 'pi pi-fw pi-key', routerLink: ['/account/password'] }] }
        ];
    });
}
