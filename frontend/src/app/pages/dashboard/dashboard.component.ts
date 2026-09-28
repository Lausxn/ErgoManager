import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { SkeletonModule } from 'primeng/skeleton';
import { TagModule } from 'primeng/tag';
import { Observable } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { CompanyService } from '../companies/company.service';
import { FormService } from '../forms/form.service';
import { UserService } from '../users/user.service';
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

/** Figure that is read from the backend. */
interface ConnectedStat {
  label: string;
  highlight?: boolean;
  load: () => Observable<{ active: boolean }[]>;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, TagModule, SkeletonModule, PageHeaderComponent],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly userService = inject(UserService);
  private readonly companyService = inject(CompanyService);
  private readonly formService = inject(FormService);

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

  /** Figures read from the backend, counting only the active records. */
  private readonly connectedStats: ConnectedStat[] = [
    { label: 'Clientes activos', load: () => this.companyService.findAll() },
    { label: 'Usuarios activos', highlight: true, load: () => this.userService.findAll() },
    { label: 'Formularios activos', load: () => this.formService.findActive() }
  ];

  readonly stats = signal<StatCard[]>([
    // The backend only reads the agenda of one ergonomist, not every appointment.
    { label: 'Citas programadas', value: null, isLoading: false },
    ...this.connectedStats.map((stat) => ({ label: stat.label, value: null, isLoading: true, highlight: stat.highlight }))
  ]);

  getGreeting(): string {
    if (this.currentHour < 12) return 'Buenos días';
    if (this.currentHour < 18) return 'Buenas tardes';
    return 'Buenas noches';
  }

  ngOnInit(): void {
    for (const stat of this.connectedStats) {
      stat.load().subscribe({
        next: (records) => this.setStat(stat.label, records.filter((record) => record.active).length),
        error: () => this.setStat(stat.label, null)
      });
    }
  }

  /**
   * Stores the value of a figure once its request finished.
   *
   * @param label label of the figure
   * @param value number of active records, or null when it could not be read
   */
  private setStat(label: string, value: number | null): void {
    this.stats.update((stats) => stats.map((stat) => (stat.label === label ? { ...stat, value, isLoading: false } : stat)));
  }
}
