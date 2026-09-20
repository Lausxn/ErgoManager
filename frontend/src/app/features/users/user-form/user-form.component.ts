import { Component, inject, input, numberAttribute, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';

import { Role } from '../../../shared/models/role.model';
import { UserRequest } from '../../../shared/models/user.model';
import { UserService } from '../user.service';

const MIN_PASSWORD_LENGTH = 8;

/**
 * Form used to register a new administrator or ergonomist, or to edit one.
 */
@Component({
  selector: 'app-user-form',
  imports: [ReactiveFormsModule],
  templateUrl: './user-form.component.html',
  styleUrl: './user-form.component.css',
})
export class UserFormComponent {
  private readonly formBuilder = inject(FormBuilder);

  private readonly userService = inject(UserService);

  private readonly router = inject(Router);

  /** Identifier of the user being edited, absent when creating a new one. */
  readonly id = input<number | undefined, unknown>(undefined, {
    transform: numberAttribute,
  });

  protected readonly roleList: readonly Role[] = ['ADMIN', 'ERGONOMIST'];

  protected readonly userForm = this.formBuilder.nonNullable.group({
    firstName: ['', [Validators.required]],
    firstLastName: ['', [Validators.required]],
    secondLastName: [''],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(MIN_PASSWORD_LENGTH)]],
    role: ['ERGONOMIST' as Role, [Validators.required]],
  });

  protected readonly isSubmitting = signal(false);

  /**
   * Sends the form to the backend, creating or updating the user.
   */
  protected submit(): void {
    if (this.userForm.invalid) {
      this.userForm.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    const request: UserRequest = this.userForm.getRawValue();
    const userId = this.id();
    const saved$ =
      userId === undefined
        ? this.userService.create(request)
        : this.userService.update(userId, request);

    saved$.subscribe({
      next: () => {
        this.isSubmitting.set(false);
        void this.router.navigate(['/users']);
      },
      error: () => this.isSubmitting.set(false),
    });
  }
}
