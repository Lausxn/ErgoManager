import { Component, OnInit, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

interface FunctionCard {
  id: number;
  title: string;
  description: string;
  color: 'red' | 'gray';
  route: string;
}

interface StatCard {
  label: string;
  value: number;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit {
  private readonly authService = inject(AuthService);

  /** First name of the signed in user, shown in the greeting. */
  userName = computed(() => this.authService.session()?.fullName.split(' ')[0] ?? '');
  currentHour = new Date().getHours();

  functionCards: FunctionCard[] = [
    { id: 1, title: 'Formularios', description: 'Cree, edite y desactive los formularios.', color: 'red', route: '/forms' },
    { id: 2, title: 'Citas', description: 'Programe visitas y evaluaciones.', color: 'gray', route: '/appointments' },
    { id: 3, title: 'Perfiles de clientes', description: 'Cree y gestione empresas cliente.', color: 'red', route: '/companies' },
    { id: 4, title: 'Reportes', description: 'Genere informes ergonómicos.', color: 'gray', route: '/history' },
    { id: 5, title: 'Gestión de usuarios', description: 'Cree cuentas de Admin y Ergonomista.', color: 'red', route: '/users' }
  ];

  stats: StatCard[] = [
    { label: 'Citas programadas', value: 3 },
    { label: 'Clientes activos', value: 28 },
    { label: 'Usuarios activos', value: 4 },
    { label: 'Formularios activos', value: 5 }
  ];

  constructor(private router: Router) {}

  getGreeting(): string {
    if (this.currentHour < 12) return 'Buenos días';
    if (this.currentHour < 18) return 'Buenas tardes';
    return 'Buenas noches';
  }

  navigateTo(route: string): void {
    this.router.navigate([route]);
  }

  ngOnInit(): void {}
}