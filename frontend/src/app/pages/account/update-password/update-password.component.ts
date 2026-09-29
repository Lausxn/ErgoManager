import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { PasswordModule } from 'primeng/password';

import { HasUnsavedChanges } from '../../../core/guards/unsaved-changes.guard';
import { AuthService } from '../../../core/services/auth.service';
import { FormFieldComponent } from '../../../shared/components/form-field/form-field.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { SaveBarComponent } from '../../../shared/components/save-bar/save-bar.component';
import { trackUnsavedChanges } from '../../../shared/forms/unsaved-changes';
import { getApiErrorMessage, getApiFieldErrors } from '../../../shared/utils/api-error';
import { markFormAsDirty } from '../../../shared/utils/form';
import { PASSWORD_RULES, PASSWORD_STRENGTH_LABELS, compareFieldsValidator, getPasswordStrength, strongPasswordValidator } from '../../../shared/utils/password';

type PasswordField = 'currentPassword' | 'newPassword' | 'confirmPassword';

const UPDATE_FAILED_MESSAGE = 'No se pudo actualizar la contraseña. Intente de nuevo en unos minutos.';

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
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [ReactiveFormsModule, RouterLink, ButtonModule, PasswordModule, FormFieldComponent, PageHeaderComponent, SaveBarComponent],
    templateUrl: './update-password.component.html'
})
export class UpdatePasswordComponent implements HasUnsavedChanges {
    private readonly formBuilder = inject(FormBuilder);

    private readonly authService = inject(AuthService);

    private readonly destroyRef = inject(DestroyRef);

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

    /** Keeps the typed passwords from being lost by leaving the page, like the save bar of Discord. */
    protected readonly unsaved = trackUnsavedChanges(this.passwordForm);

    protected readonly homeUrl = this.authService.getHomeUrl();

    protected readonly currentErrors = { required: 'Escriba su contraseña actual o la temporal que recibió.' };

    protected readonly newErrors = { weakPassword: 'La contraseña todavía no cumple todos los requisitos.' };

    protected readonly confirmErrors = { required: 'Repita la nueva contraseña.' };

    protected readonly passwordRules = PASSWORD_RULES;

    protected readonly strengthSegments = STRENGTH_SEGMENTS;

    protected readonly isSubmitting = signal(false);

    protected readonly errorMessage = signal<string | null>(null);

    protected readonly isUpdated = signal(false);

    private readonly newPassword = toSignal(this.passwordForm.controls.newPassword.valueChanges, { initialValue: '' });

    protected readonly strength = computed(() => getPasswordStrength(this.newPassword()));

    protected readonly strengthLabel = computed(() => PASSWORD_STRENGTH_LABELS[this.strength()]);

    private readonly confirmPassword = toSignal(this.passwordForm.controls.confirmPassword.valueChanges, { initialValue: '' });

    /** Positive feedback under the confirmation, shown as soon as both values are equal. */
    protected readonly passwordsMatch = computed(() => this.confirmPassword() !== '' && this.confirmPassword() === this.newPassword());

    /** Keys of the rules the new password already meets. */
    protected readonly metRules = computed(() => new Set(PASSWORD_RULES.filter((rule) => rule.test(this.newPassword())).map((rule) => rule.key)));

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
        if (this.isSubmitting()) {
            return;
        }
        if (this.passwordForm.invalid) {
            markFormAsDirty(this.passwordForm);
            this.errorMessage.set('Complete los requisitos de la nueva contraseña antes de guardar.');
            return;
        }

        this.isSubmitting.set(true);
        this.errorMessage.set(null);
        const { currentPassword, newPassword } = this.passwordForm.getRawValue();

        // changePassword stores the renewed session returned by the backend.
        this.authService
            .changePassword({ currentPassword, newPassword })
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: () => {
                    this.isSubmitting.set(false);
                    this.passwordForm.reset();
                    this.unsaved.markSaved();
                    this.isUpdated.set(true);
                },
                error: (error: unknown) => {
                    this.isSubmitting.set(false);
                    // A field message is more precise than the general "check the data" one.
                    const [firstFieldError] = Object.values(getApiFieldErrors(error));
                    this.errorMessage.set(firstFieldError ?? getApiErrorMessage(error, UPDATE_FAILED_MESSAGE));
                }
            });
    }

    /** Called by unsavedChangesGuard before leaving the page. */
    canLeave(): boolean {
        return this.unsaved.canLeave();
    }

    /** Clears the messages of a failed save after the changes were discarded. */
    protected clearError(): void {
        this.errorMessage.set(null);
    }
}
