import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TooltipModule } from 'primeng/tooltip';

import { AuthService } from '../../../core/services/auth.service';
import { LayoutService } from '../../../layout/service/layout.service';
import { BrandLogoComponent } from '../../../shared/components/brand-logo/brand-logo.component';
import { SidebarNavComponent } from '../../../shared/components/sidebar-nav/sidebar-nav.component';
import { getApiErrorMessage, getApiFieldErrors } from '../../../shared/utils/api-error';
import { isControlInvalid, markFormAsDirty } from '../../../shared/utils/form';
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
    imports: [ReactiveFormsModule, RouterLink, ButtonModule, InputTextModule, TooltipModule, BrandLogoComponent, SidebarNavComponent],
    templateUrl: './update-password.component.html'
})
export class UpdatePasswordComponent {
    private readonly formBuilder = inject(FormBuilder);

    private readonly authService = inject(AuthService);

    private readonly router = inject(Router);

    protected readonly layoutService = inject(LayoutService);

    /** Desktop: the side navigation was hidden with the menu button. */
    protected readonly isSidebarCollapsed = computed(() => !!this.layoutService.layoutState().staticMenuDesktopInactive);

    /** Phones: the side navigation is open over the page. */
    protected readonly isSidebarOpen = computed(() => !!this.layoutService.layoutState().staticMenuMobileActive);

    /** Whether the side navigation is on screen, for the aria-expanded of the button. */
    protected isSidebarVisible(): boolean {
        return this.layoutService.isDesktop() ? !this.isSidebarCollapsed() : this.isSidebarOpen();
    }

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

    private readonly confirmPassword = toSignal(this.passwordForm.controls.confirmPassword.valueChanges, { initialValue: '' });

    /** Positive feedback under the confirmation, shown as soon as both values are equal. */
    protected readonly passwordsMatch = computed(() => this.confirmPassword() !== '' && this.confirmPassword() === this.newPassword());

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
            error: (error: unknown) => {
                this.isSubmitting.set(false);
                // A field message is more precise than the general "check the data" one.
                const [firstFieldError] = Object.values(getApiFieldErrors(error));
                this.errorMessage.set(firstFieldError ?? getApiErrorMessage(error, UPDATE_FAILED_MESSAGE));
            }
        });
    }

    /**
     * Closes the side navigation opened over the page on phones.
     */
    protected closeSidebar(): void {
        this.layoutService.layoutState.update((state) => ({ ...state, staticMenuMobileActive: false }));
    }

    /**
     * Leaves the page without saving and goes back to the home page of the role.
     */
    protected cancel(): void {
        void this.router.navigateByUrl(this.homeUrl);
    }
}
