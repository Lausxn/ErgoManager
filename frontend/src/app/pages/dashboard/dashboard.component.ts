import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterModule } from '@angular/router';

import { AuthService } from '../../core/services/auth.service';

interface FunctionCard {
    id: number;
    title: string;
    description: string;
    icon: string;
    color: 'red' | 'gray';
    route: string;
}

interface StatCard {
    label: string;
    value: number;
    highlight?: boolean;
}

/**
 * Home dashboard shared by administrators and ergonomists.
 * The available options are derived from the signed-in user's role.
 */
@Component({
    selector: 'app-dashboard',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [CommonModule, RouterModule],
    templateUrl: './dashboard.component.html',
    styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent {
    private readonly authService = inject(AuthService);

    protected readonly userName = computed(() => this.authService.session()?.fullName.split(' ')[0] ?? '');

    protected readonly role = computed(() => this.authService.session()?.role ?? 'ERGONOMIST');

    protected readonly profileLabel = computed(() => (this.role() === 'ERGONOMIST' ? 'Perfil ergonomista' : 'Perfil administrador'));

    protected readonly functionCards = computed<FunctionCard[]>(() => {
        if (this.role() === 'ERGONOMIST') {
            return [
                {
                    id: 1,
                    title: 'Formularios',
                    description: 'Consulte y gestione los formularios utilizados en las evaluaciones ergonómicas.',
                    icon: 'pi pi-file-edit',
                    color: 'red',
                    route: '/forms'
                },
                {
                    id: 2,
                    title: 'Agenda de citas',
                    description: 'Consulte y gestione las citas y espacios disponibles para atención.',
                    icon: 'pi pi-calendar',
                    color: 'gray',
                    route: '/appointments'
                },
                {
                    id: 3,
                    title: 'Perfiles de clientes',
                    description: 'Consulte la información de las empresas cliente y sus colaboradores.',
                    icon: 'pi pi-building',
                    color: 'red',
                    route: '/companies'
                },
                {
                    id: 4,
                    title: 'Evaluación personalizada',
                    description: 'Realice evaluaciones ergonómicas personalizadas para los colaboradores.',
                    icon: 'pi pi-clipboard',
                    color: 'gray',
                    route: '/personalized-evaluations'
                },
                {
                    id: 5,
                    title: 'Reportes',
                    description: 'Consulte el historial y los resultados de las evaluaciones ergonómicas.',
                    icon: 'pi pi-chart-bar',
                    color: 'red',
                    route: '/history'
                }
            ];
        }
        return [
            { id: 1, title: 'Formularios', description: 'Cree, edite y desactive los formularios del sistema.', icon: 'pi pi-file', color: 'red', route: '/forms' },
            { id: 2, title: 'Citas', description: 'Programe visitas y evaluaciones presenciales con los clientes.', icon: 'pi pi-calendar-plus', color: 'gray', route: '/appointments' },
            { id: 3, title: 'Perfiles de clientes', description: 'Cree y gestione los perfiles de todas las empresas cliente.', icon: 'pi pi-building', color: 'red', route: '/companies' },
            { id: 4, title: 'Reportes', description: 'Genere y descargue los informes de resultados ergonómicos.', icon: 'pi pi-chart-bar', color: 'gray', route: '/history' },
            { id: 5, title: 'Gestión de usuarios', description: 'Cree, edite y desactive cuentas de Administrador y Ergonomista.', icon: 'pi pi-users', color: 'red', route: '/users' }
        ];
    });

    protected readonly subtitle = computed(() => {
        const total = this.functionCards().length;
        return `Estas son las ${total === 4 ? 'cuatro' : 'cinco'} funciones habilitadas para su perfil.`;
    });

    protected readonly stats = computed<StatCard[]>(() =>
        this.role() === 'ADMIN'
            ? [
                  { label: 'Citas programadas', value: 3 },
                  { label: 'Clientes activos', value: 28 },
                  { label: 'Usuarios activos', value: 4, highlight: true },
                  { label: 'Formularios activos', value: 5 }
              ]
            : []
    );

    private readonly currentHour = new Date().getHours();

    protected getGreeting(): string {
        if (this.currentHour < 12) return 'Buenos días';
        if (this.currentHour < 18) return 'Buenas tardes';
        return 'Buenas noches';
    }
}
