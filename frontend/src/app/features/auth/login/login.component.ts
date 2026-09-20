import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';

import { AuthService } from '../../../core/services/auth.service';

const MIN_PASSWORD_LENGTH = 8;

/**
 * Sign in screen of the administrators and the ergonomists.
 */
@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
})
export class LoginComponent {
  private readonly formBuilder = inject(FormBuilder);

  private readonly authService = inject(AuthService);

  private readonly router = inject(Router);

  protected readonly loginForm = this.formBuilder.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(MIN_PASSWORD_LENGTH)]],
  });

  protected readonly errorMessage = signal<string | null>(null);

  protected readonly isSubmitting = signal(false);

  /**
   * Sends the credentials to the backend and opens the application when they
   * are accepted.
   */
  protected submit(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    this.authService.login(this.loginForm.getRawValue()).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        void this.router.navigate(['/companies']);
      },
      error: () => {
        this.isSubmitting.set(false);
        this.errorMessage.set('Email or password is not valid');
      },
    });
  }
}
