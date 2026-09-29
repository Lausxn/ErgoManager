import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { SkeletonModule } from 'primeng/skeleton';
import { TagModule } from 'primeng/tag';
import { AuthService } from '../../core/services/auth.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';

/**
 * Option of the dashboard. A null route marks an option whose function does
 * not exist in the backend yet, so it is shown disabled.
 */
export interface FunctionCard {
  id: number;
  title: string;
  description: string;
  /** PrimeIcons class shown next to the title. */
  icon: string;
  color: 'red' | 'gray';
  route: string | null;
}

/**
 * Figure of the dashboard. A null value means that it could not be read: the
 * backend has no function for it yet, or the request failed.
 */
export interface StatCard {
  label: string;
  value: number | null;
  isLoading: boolean;
  /** Shows the value in the brand color. */
  highlight?: boolean;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, TagModule, SkeletonModule, PageHeaderComponent],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent {
  private readonly authService = inject(AuthService);

  /** First name of the signed in user, shown in the greeting. */
  userName = computed(() => this.authService.session()?.fullName.split(' ')[0] ?? '');
  currentHour = new Date().getHours();

  functionCards: FunctionCard[] = [
    { id: 1, title: 'Formularios', description: 'Cree, edite y desactive los formularios del sistema.', icon: 'pi pi-file', color: 'red', route: '/forms' },
    { id: 2, title: 'Citas', description: 'Programe visitas y evaluaciones presenciales con los clientes.', icon: 'pi pi-calendar-plus', color: 'gray', route: '/appointments' },
    { id: 3, title: 'Perfiles de clientes', description: 'Cree y gestione los perfiles de todas las empresas cliente.', icon: 'pi pi-building', color: 'red', route: '/companies' },
    // The backend has no report function for the administrator yet.
    { id: 4, title: 'Reportes', description: 'Genere y descargue los informes de resultados ergonómicos.', icon: 'pi pi-chart-bar', color: 'gray', route: null },
    { id: 5, title: 'Gestión de usuarios', description: 'Cree, edite y desactive cuentas de Administrador y Ergonomista.', icon: 'pi pi-users', color: 'red', route: '/users' }
  ];

  /**
   * Figures of the system. They are connected to the backend in Task 31;
   * until then no invented number is shown.
   */
  readonly stats = signal<StatCard[]>([
    { label: 'Citas programadas', value: null, isLoading: false },
    { label: 'Clientes activos', value: null, isLoading: false },
    { label: 'Usuarios activos', value: null, isLoading: false, highlight: true },
    { label: 'Formularios activos', value: null, isLoading: false }
  ]);

  getGreeting(): string {
    if (this.currentHour < 12) return 'Buenos días';
    if (this.currentHour < 18) return 'Buenas tardes';
    return 'Buenas noches';
  }
}
