import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterOutlet } from '@angular/router';

import { AuthService } from './core/services/auth.service';

/**
 * Shell of the application: it shows the navigation bar when a user is signed
 * in and hosts the routed views.
 */
@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent {
  private readonly router = inject(Router);

  protected readonly authService = inject(AuthService);

  protected readonly title = signal('ErgoManager');

  /**
   * Clears the session and sends the user back to the login page.
   */
  protected logout(): void {
    this.authService.logout();
    void this.router.navigate(['/login']);
  }
}
