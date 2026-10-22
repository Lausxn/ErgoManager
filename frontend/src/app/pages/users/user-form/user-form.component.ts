import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { map, merge } from 'rxjs';
import { AvatarModule } from 'primeng/avatar';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { ProgressBarModule } from 'primeng/progressbar';
import { RadioButtonModule } from 'primeng/radiobutton';
import { TagModule } from 'primeng/tag';

import { HasUnsavedChanges } from '../../../core/guards/unsaved-changes.guard';
import { FormFieldComponent } from '../../../shared/components/form-field/form-field.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { SaveBarComponent } from '../../../shared/components/save-bar/save-bar.component';
import { trackUnsavedChanges } from '../../../shared/forms/unsaved-changes';
import { Role } from '../../../shared/models/role.model';
import { UserRequest } from '../../../shared/models/user.model';
import { ToastService } from '../../../shared/services/toast.service';
import { applyApiErrors, isConflict } from '../../../shared/utils/api-error';
import { markFormAsDirty, notBlank } from '../../../shared/utils/form';
import { ROLE_LABELS, ROLE_TAG_CLASSES } from '../../../shared/utils/labels';
import { compareFieldsValidator } from '../../../shared/utils/password';
import { UserService } from '../user.service';
import { passwordByteLimit, userEmailValidator } from './user-validation';

/** Limits of UserRequestDTO in the backend. */
const MAX_NAME_LENGTH = 60;
const MAX_EMAIL_LENGTH = 120;
const MIN_PASSWORD_LENGTH = 8;

/** Message shown under the email when the backend answers HTTP 409. */
const DUPLICATED_EMAIL_MESSAGE = 'Ya existe un usuario con este correo.';

/**
 * Form used to register a new administrator or ergonomist. The temporary
 * password is required and is emailed to the person. Existing users are
 * edited in the edition page of HU-014.
 */
@Component({
    selector: 'app-user-form',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [ReactiveFormsModule, RouterLink, AvatarModule, ButtonModule, InputTextModule, PasswordModule, ProgressBarModule, RadioButtonModule, TagModule, FormFieldComponent, PageHeaderComponent, SaveBarComponent],
    templateUrl: './user-form.component.html'
})
export class UserFormComponent implements HasUnsavedChanges {
    private readonly formBuilder = inject(FormBuilder);
    private readonly userService = inject(UserService);
    private readonly toastService = inject(ToastService);
    private readonly router = inject(Router);
    private readonly destroyRef = inject(DestroyRef);
    protected readonly limits = { name: MAX_NAME_LENGTH, email: MAX_EMAIL_LENGTH };
    protected readonly roleLabels = ROLE_LABELS;
    protected readonly roleTagClasses = ROLE_TAG_CLASSES;
    protected readonly emailErrors = { duplicated: DUPLICATED_EMAIL_MESSAGE };

    protected readonly passwordErrors = {
        passwordBytes: 'La contraseña no puede superar 72 bytes; las tildes y emojis ocupan más de uno.',
        minlength: `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`
    };

    protected readonly confirmErrors = { passwordMismatch: 'Las contraseñas no coinciden.' };

    /** Roles offered in the form, with what each one allows. */
    protected readonly roleChoices: { value: Role; description: string; icon: string }[] = [
        { value: 'ERGONOMIST', description: 'Realiza evaluaciones personalizadas y gestiona su propia agenda.', icon: 'fa-solid fa-user-doctor' },
        { value: 'ADMIN', description: 'Acceso completo: gestiona empresas, usuarios y formularios.', icon: 'fa-solid fa-user-shield' }
    ];

    protected readonly userForm = this.formBuilder.nonNullable.group(
        {
            firstName: ['', [Validators.required, notBlank, Validators.maxLength(MAX_NAME_LENGTH)]],
            firstLastName: ['', [Validators.required, notBlank, Validators.maxLength(MAX_NAME_LENGTH)]],
            secondLastName: ['', [Validators.maxLength(MAX_NAME_LENGTH)]],
            email: ['', [userEmailValidator]],
            password: ['', [Validators.required, notBlank, Validators.minLength(MIN_PASSWORD_LENGTH), passwordByteLimit]],
            confirmPassword: ['', [Validators.required]],
            role: ['ERGONOMIST' as Role, [Validators.required]]
        },
        { validators: compareFieldsValidator('confirmPassword', 'password', true, 'passwordMismatch') }
    );

    protected readonly unsaved = trackUnsavedChanges(this.userForm);
    protected readonly errorMessage = signal<string | null>(null);
    protected readonly isSubmitting = signal(false);

    /** Every value of the form, recomputed after each change of value or status. */
    private readonly formValue = toSignal(merge(this.userForm.valueChanges, this.userForm.statusChanges).pipe(map(() => this.userForm.getRawValue())), { initialValue: this.userForm.getRawValue() });

    protected readonly preview = computed(() => {
        const { firstName, firstLastName, secondLastName, email, role } = this.formValue();
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

    /** Fields that must hold a valid value before saving. */
    private readonly requiredFields = ['firstName', 'firstLastName', 'email', 'password', 'confirmPassword'] as const;
    protected readonly requiredCount = this.requiredFields.length;

    protected readonly completedCount = computed(() => {
        this.formValue();
        return this.requiredFields.filter((field) => this.userForm.controls[field].valid).length;
    });

    protected readonly progress = computed(() => Math.round((this.completedCount() / this.requiredCount) * 100));

    /** Called by unsavedChangesGuard before leaving the page. */
    canLeave(): boolean {
        return this.unsaved.canLeave();
    }

    /** Clears the messages of a failed save after the changes were discarded. */
    protected clearError(): void {
        this.errorMessage.set(null);
    }

    /** Sends validated data to the backend, keeping the values after an error. */
    protected submit(): void {
        if (this.isSubmitting()) {
            return;
        }
        if (this.userForm.invalid) {
            markFormAsDirty(this.userForm);
            this.errorMessage.set('Revise los campos marcados antes de guardar.');
            return;
        }

        this.errorMessage.set(null);
        this.isSubmitting.set(true);

        this.userService
            .create(this.buildRequest())
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (user) => {
                    this.isSubmitting.set(false);
                    this.userForm.patchValue({ password: '', confirmPassword: '' });
                    this.unsaved.markSaved();
                    this.toastService.success('Usuario creado con éxito', `Enviamos las credenciales de acceso a ${user.email}.`);
                    void this.router.navigate(['/users']);
                },
                error: (error: unknown) => {
                    this.isSubmitting.set(false);
                    if (isConflict(error)) {
                        const email = this.userForm.controls.email;
                        email.setErrors({ ...email.errors, duplicated: true });
                        email.markAsTouched();
                        this.errorMessage.set(DUPLICATED_EMAIL_MESSAGE);
                        return;
                    }
                    this.errorMessage.set(applyApiErrors(this.userForm, error, 'No se pudo guardar. Intente de nuevo.'));
                }
            });
    }

    /**
     * Builds the body of the request with clean values: trimmed names, email in
     * lower case and no empty second last name.
     */
    private buildRequest(): UserRequest {
        const { firstName, firstLastName, secondLastName, email, password, role } = this.userForm.getRawValue();
        return {
            firstName: firstName.trim(),
            firstLastName: firstLastName.trim(),
            secondLastName: secondLastName.trim() || undefined,
            email: email.trim().toLowerCase(),
            password,
            role
        };
    }
}
