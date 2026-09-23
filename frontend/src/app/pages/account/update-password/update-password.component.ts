import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputGroupModule } from 'primeng/inputgroup';
import { InputGroupAddonModule } from 'primeng/inputgroupaddon';
import { InputTextModule } from 'primeng/inputtext';

import { AuthService } from '../../../core/services/auth.service';
import { BrandLogoComponent } from '../../../shared/components/brand-logo/brand-logo.component';
import { isControlInvalid, markFormAsDirty } from '../../../shared/utils/form';
import { PASSWORD_RULES, PASSWORD_STRENGTH_LABELS, compareFieldsValidator, getPasswordStrength, strongPasswordValidator } from '../../../shared/utils/password';

type PasswordField = 'currentPassword' | 'newPassword' | 'confirmPassword';

const BAD_REQUEST_STATUS = 400;

/** Number of segments of the strength meter, one per level above zero. */
const STRENGTH_SEGMENTS = [1, 2, 3, 4] as const;

/**
 * Full screen page where a signed in administrator or ergonomist replaces the
 * current (or temporary) password. It is opened from the password update
 * popup, so it lives outside the main layout.
 */
@Component({
    selector: 'app-update-password',
    standalone: true,
    imports: [ReactiveFormsModule, RouterLink, ButtonModule, InputTextModule, InputGroupModule, InputGroupAddonModule, BrandLogoComponent],
    templateUrl: './update-password.component.html'
})
export class UpdatePasswordComponent {
    private readonly formBuilder = inject(FormBuilder);

    private readonly authService = inject(AuthService);

    private readonly router = inject(Router);

    protected readonly passwordForm = this.formBuilder.nonNullable.group(
        {
            currentPassword: ['', [Validators.required]],
            newPassword: ['', [Validators.required, strongPasswordValidator]],
            confirmPassword: ['', [Validators.required]]
        },
        {
            validators: [compareFieldsValidator('confirmPassword', 'newPassword', true, 'passwordMismatch'), compareFieldsValidator('newPassword', 'currentPassword', false, 'samePassword')]
        }
    );

    protected readonly homeUrl = this.authService.getHomeUrl();

    protected readonly passwordRules = PASSWORD_RULES;

    protected readonly strengthSegments = STRENGTH_SEGMENTS;

    /** Fields whose value is currently visible. */
    protected readonly visibleFields = signal<ReadonlySet<PasswordField>>(new Set());

    protected readonly isSubmitting = signal(false);

    protected readonly errorMessage = signal<string | null>(null);

    protected readonly isUpdated = signal(false);

    private readonly newPassword = toSignal(this.passwordForm.controls.newPassword.valueChanges, { initialValue: '' });

    protected readonly strength = computed(() => getPasswordStrength(this.newPassword()));

    protected readonly strengthLabel = computed(() => PASSWORD_STRENGTH_LABELS[this.strength()]);

    /** Keys of the rules the new password already meets. */
    protected readonly metRules = computed(() => new Set(PASSWORD_RULES.filter((rule) => rule.test(this.newPassword())).map((rule) => rule.key)));

    /**
     * Shows or hides the value of a password field.
     *
     * @param field name of the control
     */
    protected toggleVisibility(field: PasswordField): void {
        this.visibleFields.update((fields) => {
            const next = new Set(fields);
            if (!next.delete(field)) {
                next.add(field);
            }
            return next;
        });
    }

    /**
     * Checks whether the value of a password field is visible.
     *
     * @param field name of the control
     * @returns true while the field shows plain text
     */
    protected isVisible(field: PasswordField): boolean {
        return this.visibleFields().has(field);
    }

    /**
     * Checks whether a field has to show its error message.
     *
     * @param field name of the control
     * @returns true when the value is invalid and the user worked on it
     */
    protected isInvalid(field: PasswordField): boolean {
        return isControlInvalid(this.passwordForm.controls[field]);
    }

    /**
     * Checks whether a group level error applies to a field the user already
     * worked on.
     *
     * @param errorKey key set by compareFieldsValidator
     * @param field    field that shows the message
     * @returns true when the message has to be shown
     */
    protected hasGroupError(errorKey: 'passwordMismatch' | 'samePassword', field: PasswordField): boolean {
        const control = this.passwordForm.controls[field];
        return this.passwordForm.hasError(errorKey) && (control.touched || control.dirty);
    }

    /**
     * Sends the passwords to the backend and shows the confirmation when the
     * change is accepted.
     */
    protected submit(): void {
        if (this.passwordForm.invalid) {
            markFormAsDirty(this.passwordForm);
            return;
        }

        this.isSubmitting.set(true);
        this.errorMessage.set(null);
        const { currentPassword, newPassword } = this.passwordForm.getRawValue();

        this.authService.changePassword({ currentPassword, newPassword }).subscribe({
            next: () => {
                this.isSubmitting.set(false);
                this.passwordForm.reset();
                this.isUpdated.set(true);
            },
            error: (error: HttpErrorResponse) => {
                this.isSubmitting.set(false);
                this.errorMessage.set(error.status === BAD_REQUEST_STATUS ? 'La contraseña actual no es correcta o la nueva no cumple los requisitos.' : 'No se pudo actualizar la contraseña. Intente de nuevo en unos minutos.');
            }
        });
    }

    /**
     * Leaves the page without saving and goes back to the home page of the role.
     */
    protected cancel(): void {
        void this.router.navigateByUrl(this.homeUrl);
    }
}
