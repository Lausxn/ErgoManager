import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { MessageService } from 'primeng/api';
import { UserService } from '../user.service';

@Component({
  selector: 'app-deactivate-user-confirmation',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './deactivate-user-confirmation.component.html',
  styleUrls: ['./deactivate-user-confirmation.component.scss']
})
export class DeactivateUserConfirmationComponent implements OnInit {
  userId: string | null = null;
  userName: string = '';
  isLoading = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private userService: UserService,
    private messageService: MessageService
  ) {}

  ngOnInit(): void {
    this.userId = this.route.snapshot.queryParamMap.get('id');
    this.userName = this.route.snapshot.queryParamMap.get('name') || 'Usuario';
  }

  deactivateUser(): void {
    if (!this.userId) return;

    this.isLoading = true;
    this.userService.deactivate(Number(this.userId)).subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: 'Usuario desactivado', detail: this.userName });
        this.router.navigate(['/users']);
      },
      error: (error: HttpErrorResponse) => {
        this.isLoading = false;
        this.messageService.add({
          severity: 'error',
          summary: 'No se pudo desactivar',
          detail: error.error?.message ?? 'Intente de nuevo más tarde.'
        });
      }
    });
  }

  cancel(): void {
    this.router.navigate(['/users']);
  }
}