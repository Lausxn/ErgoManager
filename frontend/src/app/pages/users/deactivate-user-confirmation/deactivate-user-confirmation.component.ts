import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
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
    private userService: UserService
  ) {}

  ngOnInit(): void {
    this.userId = this.route.snapshot.queryParamMap.get('id');
    this.userName = this.route.snapshot.queryParamMap.get('name') || 'Usuario';
  }

  deactivateUser(): void {
    if (!this.userId) return;

    this.isLoading = true;
    this.userService.deactivate(Number(this.userId)).subscribe({  // ← CAMBIO AQUÍ
      next: () => {
        this.router.navigate(['/users']);
      },
      error: (err) => {
        console.error('Error desactivando usuario:', err);
        this.isLoading = false;
      }
    });
  }

  cancel(): void {
    this.router.navigate(['/users']);
  }
}