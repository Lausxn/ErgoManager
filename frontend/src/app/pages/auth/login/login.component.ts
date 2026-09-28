import { Component, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';

import { AuthService } from '../../../core/services/auth.service';
import { AppFloatingConfigurator } from '../../../layout/component/app.floatingconfigurator';
import { BrandLogoComponent } from '../../../shared/components/brand-logo/brand-logo.component';
import { isControlInvalid, markFormAsDirty } from '../../../shared/utils/form';

const MIN_PASSWORD_LENGTH = 8;

/**
 * Sign in screen of the administrators and the ergonomists. After a valid
 * sign in it reopens the page the guard interrupted, or the home page of the
 * role.
 */
@Component({
    selector: 'app-login',
    standalone: true,
    imports: [ReactiveFormsModule, RouterLink, ButtonModule, InputTextModule, PasswordModule, IconFieldModule, InputIconModule, AppFloatingConfigurator, BrandLogoComponent],
    templateUrl: './login.component.html'
})
export class LoginComponent {
    private readonly formBuilder = inject(FormBuilder);

    private readonly authService = inject(AuthService);

    private readonly router = inject(Router);

    /** Url requested before the sign in, bound from the query string. */
    readonly redirectTo = input<string | undefined>(undefined);

    protected readonly loginForm = this.formBuilder.nonNullable.group({
        email: ['', [Validators.required, Validators.email]],
        password: ['', [Validators.required, Validators.minLength(MIN_PASSWORD_LENGTH)]]
    });

    protected readonly errorMessage = signal<string | null>(null);

    protected readonly isSubmitting = signal(false);

    protected readonly currentYear = new Date().getFullYear();

    protected readonly highlightList = [
        { icon: 'pi pi-check-square', text: 'Autoevaluaciones con nivel de riesgo inmediato' },
        { icon: 'pi pi-calendar', text: 'Agenda de citas con el ergonomista' },
        { icon: 'pi pi-file-pdf', text: 'Evaluaciones personalizadas y reportes en PDF' }
    ];

    /**
     * Checks whether a field was touched and holds an invalid value.
     *
     * @param field name of the control
     * @returns true when the error has to be shown
     */
    protected isInvalid(field: 'email' | 'password'): boolean {
        return isControlInvalid(this.loginForm.controls[field]);
    }

    /**
     * Sends the credentials to the backend and opens the application when they
     * are accepted.
     */
    protected submit(): void {
        if (this.loginForm.invalid) {
            markFormAsDirty(this.loginForm);
            return;
        }

        this.isSubmitting.set(true);
        this.errorMessage.set(null);

        this.authService.login(this.loginForm.getRawValue()).subscribe({
            next: () => {
                this.isSubmitting.set(false);
                void this.router.navigateByUrl(this.resolveTargetUrl());
            },
            error: () => {
                this.isSubmitting.set(false);
                this.errorMessage.set('El correo o la contraseña no son válidos.');
            }
        });
    }

    /**
     * Picks the page to open after the sign in. Only internal urls are
     * accepted, so the query string cannot send the user to another site.
     *
     * @returns url to navigate to
     */
    private resolveTargetUrl(): string {
        const redirectTo = this.redirectTo();
        const isInternal = redirectTo?.startsWith('/') && !redirectTo.startsWith('//') && !redirectTo.startsWith('/auth');
        return isInternal ? redirectTo! : this.authService.getHomeUrl();
    }
}
