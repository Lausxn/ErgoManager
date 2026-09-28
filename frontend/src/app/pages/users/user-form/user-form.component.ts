import { HttpErrorResponse, HttpStatusCode } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AvatarModule } from 'primeng/avatar';
import { ButtonModule } from 'primeng/button';
import { PasswordModule } from 'primeng/password';
import { ProgressBarModule } from 'primeng/progressbar';
import { TagModule } from 'primeng/tag';

import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { UserRequest } from '../../../shared/models/user.model';
import { ToastService } from '../../../shared/services/toast.service';
import { isControlInvalid, markFormAsDirty } from '../../../shared/utils/form';
import { ROLE_LABELS, ROLE_TAG_CLASSES } from '../../../shared/utils/labels';
import { USER_LIMITS, createIdentityControls, toIdentityRequest } from '../shared/user-fields';
import { UserIdentityFieldsComponent } from '../shared/user-identity-fields.component';
import { UserRoleFieldComponent } from '../shared/user-role-field.component';
import { UserService } from '../user.service';

/** Fields the user has to fill in before saving. */
const REQUIRED_FIELDS = ['firstName', 'firstLastName', 'email', 'password', 'confirmPassword'] as const;

/**
 * Checks that the confirmation repeats the password.
 *
 * @param group form holding both passwords
 * @returns a passwordMismatch error when they differ
 */
function passwordsMatch(group: AbstractControl): ValidationErrors | null {
    const confirmation = group.get('confirmPassword')?.value;
    return !confirmation || group.get('password')?.value === confirmation ? null : { passwordMismatch: true };
}

/**
 * Form used to register a new administrator or ergonomist.
 */
@Component({
    selector: 'app-user-form',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [ReactiveFormsModule, RouterLink, AvatarModule, ButtonModule, PasswordModule, ProgressBarModule, TagModule, PageHeaderComponent, UserIdentityFieldsComponent, UserRoleFieldComponent],
    templateUrl: './user-form.component.html'
})
export class UserFormComponent {
    private readonly userService = inject(UserService);

    private readonly toastService = inject(ToastService);

    private readonly router = inject(Router);

    private readonly destroyRef = inject(DestroyRef);

    protected readonly limits = USER_LIMITS;

    protected readonly roleLabels = ROLE_LABELS;

    protected readonly roleTagClasses = ROLE_TAG_CLASSES;

    protected readonly userForm = new FormGroup(
        {
            ...createIdentityControls(),
            password: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(USER_LIMITS.minPassword), Validators.maxLength(USER_LIMITS.maxPassword)] }),
            confirmPassword: new FormControl('', { nonNullable: true, validators: [Validators.required] })
        },
        { validators: passwordsMatch }
    );

    protected readonly isSubmitting = signal(false);

    /** valueChanges fires after validation, so validity is already current when it emits. */
    private readonly formValue = toSignal(this.userForm.valueChanges, { initialValue: this.userForm.getRawValue() });

    protected readonly preview = computed(() => {
        const { firstName = '', firstLastName = '', secondLastName = '', email = '', role = 'ERGONOMIST' } = this.formValue();
        return {
            name: [firstName, firstLastName, secondLastName]
                .map((part) => part.trim())
                .filter(Boolean)
                .join(' '),
            initials: `${firstName.trim().charAt(0)}${firstLastName.trim().charAt(0)}`.toUpperCase(),
            email: email.trim(),
            role
        };
    });

    protected readonly requiredCount = REQUIRED_FIELDS.length;

    /** Required fields that already hold a valid value. */
    protected readonly completedCount = computed(() => {
        this.formValue();
        const passwordsDiffer = this.userForm.hasError('passwordMismatch');
        return REQUIRED_FIELDS.filter((field) => this.userForm.controls[field].valid && !(field === 'confirmPassword' && passwordsDiffer)).length;
    });

    protected readonly progress = computed(() => Math.round((this.completedCount() / this.requiredCount) * 100));

    /**
     * Checks whether a field has to show its error message.
     *
     * @param field name of the control
     * @returns true when the value is invalid and the user worked on it
     */
    protected isInvalid(field: string): boolean {
        return isControlInvalid(this.userForm.get(field));
    }

    /**
     * Checks whether the confirmation has to show that it differs from the password.
     *
     * @returns true when both passwords were typed and differ
     */
    protected isMismatch(): boolean {
        const confirmation = this.userForm.controls.confirmPassword;
        return this.userForm.hasError('passwordMismatch') && (confirmation.touched || confirmation.dirty);
    }

    /**
     * Sends the form to the backend and creates the user.
     */
    protected submit(): void {
        if (this.isSubmitting()) {
            return;
        }
        if (this.userForm.invalid) {
            markFormAsDirty(this.userForm);
            return;
        }

        this.isSubmitting.set(true);
        const value = this.userForm.getRawValue();
        const request: UserRequest = { ...toIdentityRequest(value), password: value.password };

        this.userService
            .create(request)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: () => {
                    this.isSubmitting.set(false);
                    this.toastService.success('Usuario creado', request.email);
                    void this.router.navigate(['/users']);
                },
                error: (error: HttpErrorResponse) => {
                    this.isSubmitting.set(false);
                    if (error.status === HttpStatusCode.Conflict) {
                        const email = this.userForm.controls.email;
                        email.setErrors({ duplicated: true });
                        email.markAsTouched();
                        return;
                    }
                    this.toastService.error('No se pudo crear el usuario', 'Revise los datos e intente de nuevo.');
                }
            });
    }
}
