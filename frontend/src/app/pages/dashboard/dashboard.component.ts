import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';

import { AuthService } from '../../core/services/auth.service';
import { StatCardComponent } from '../../shared/components/stat-card/stat-card.component';
import { DashboardSummary } from '../../shared/models/dashboard.model';
import { ToastService } from '../../shared/services/toast.service';
import { DashboardService } from './dashboard.service';

/** Function of the profile, shown as a numbered option card. */
interface FunctionCard {
    number: string;
    title: string;
    description: string;
    /** Font Awesome class shown in the graphite square. */
    icon: string;
    route: string;
}

/** Value shown by a key figure while it is unknown, after a failed load. */
const UNKNOWN_VALUE = '—';

/** The five functions enabled for the administrator profile (HU-001). */
const FUNCTION_CARDS: readonly FunctionCard[] = [
    { number: '01', title: 'Formularios', description: 'Cree, edite y desactive los formularios del sistema.', icon: 'fa-solid fa-file-lines', route: '/forms' },
    { number: '02', title: 'Agenda de citas', description: 'Programe visitas y evaluaciones presenciales con los clientes.', icon: 'fa-solid fa-calendar-plus', route: '/appointments' },
    { number: '03', title: 'Perfiles de clientes', description: 'Cree y gestione los perfiles de todas las empresas cliente.', icon: 'fa-solid fa-building', route: '/companies' },
    { number: '04', title: 'Reportes e historial', description: 'Genere y descargue los informes de resultados ergonómicos.', icon: 'fa-solid fa-chart-column', route: '/history' },
    { number: '05', title: 'Gestión de usuarios', description: 'Cree, edite y desactive cuentas de Administrador y Ergonomista.', icon: 'fa-solid fa-users-gear', route: '/users' }
];

/** The five functions enabled for the ergonomist profile (HU-002). */
const ERGONOMIST_FUNCTION_CARDS: readonly FunctionCard[] = [
    { number: '01', title: 'Formularios', description: 'Consulte y gestione los formularios utilizados en las evaluaciones ergonómicas.', icon: 'fa-solid fa-file-lines', route: '/forms' },
    { number: '02', title: 'Agenda de citas', description: 'Consulte y gestione las citas y espacios disponibles para atención.', icon: 'fa-solid fa-calendar-plus', route: '/appointments' },
    { number: '03', title: 'Perfiles de clientes', description: 'Consulte la información de las empresas cliente y sus colaboradores.', icon: 'fa-solid fa-building', route: '/companies' },
    { number: '04', title: 'Evaluación personalizada', description: 'Realice evaluaciones ergonómicas personalizadas para los colaboradores.', icon: 'fa-solid fa-clipboard-user', route: '/personalized-evaluations' },
    { number: '05', title: 'Reportes e historial', description: 'Consulte el historial y los resultados de las evaluaciones ergonómicas.', icon: 'fa-solid fa-chart-column', route: '/history' }
];

/**
 * Home page of the signed in user: dark impact band with the greeting and the
 * five functions of the profile. The administrator also sees the key figures
 * of the system, which the backend only gives to that role.
 */
@Component({
    selector: 'app-dashboard',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [DatePipe, RouterLink, StatCardComponent],
    templateUrl: './dashboard.component.html',
    styleUrl: './dashboard.component.scss'
})
export class DashboardComponent {
    private readonly authService = inject(AuthService);

    private readonly dashboardService = inject(DashboardService);

    private readonly toastService = inject(ToastService);

    private readonly destroyRef = inject(DestroyRef);

    protected readonly isAdmin = computed(() => this.authService.session()?.role === 'ADMIN');

    protected readonly functionCards = computed(() => (this.isAdmin() ? FUNCTION_CARDS : ERGONOMIST_FUNCTION_CARDS));

    protected readonly today = new Date();

    /** First name of the signed in user, shown in the greeting. */
    protected readonly firstName = computed(() => this.authService.session()?.fullName.trim().split(/\s+/)[0] ?? '');

    protected readonly greeting = computed(() => {
        const hour = this.today.getHours();
        const greeting = hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches';
        return this.firstName() ? `${greeting}, ${this.firstName()}.` : `${greeting}.`;
    });

    private readonly summary = signal<DashboardSummary | null>(null);

    protected readonly isLoading = signal(true);

    /** Figures of the cards, with a dash while they could not be read. */
    protected readonly figures = computed(() => {
        const summary = this.summary();
        return {
            scheduledAppointments: summary?.scheduledAppointments ?? UNKNOWN_VALUE,
            activeCompanies: summary?.activeCompanies ?? UNKNOWN_VALUE,
            activeUsers: summary?.activeUsers ?? UNKNOWN_VALUE,
            activeForms: summary?.activeForms ?? UNKNOWN_VALUE
        };
    });

    constructor() {
        if (!this.isAdmin()) {
            this.isLoading.set(false);
            return;
        }
        this.dashboardService
            .getSummary()
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (summary) => {
                    this.summary.set(summary);
                    this.isLoading.set(false);
                },
                error: () => {
                    this.isLoading.set(false);
                    this.toastService.error('No se pudieron cargar los indicadores', 'Intente de nuevo en unos minutos.');
                }
            });
    }
}
