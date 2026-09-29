import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, input, numberAttribute, signal } from '@angular/core';
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
import { SkeletonModule } from 'primeng/skeleton';
import { TagModule } from 'primeng/tag';

import { AuthService } from '../../../core/services/auth.service';
import { HasUnsavedChanges } from '../../../core/guards/unsaved-changes.guard';
import { FormFieldComponent } from '../../../shared/components/form-field/form-field.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { SaveBarComponent } from '../../../shared/components/save-bar/save-bar.component';
import { trackUnsavedChanges } from '../../../shared/forms/unsaved-changes';
import { Role } from '../../../shared/models/role.model';
import { UserRequest, UserResponse } from '../../../shared/models/user.model';
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
 * Form used to register a new administrator or ergonomist, or to edit one.
 * When creating, the temporary password is required and is emailed to the
 * person; when editing, it is optional and only replaces the stored one when
 * typed.
 */
@Component({
    selector: 'app-user-form',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [ReactiveFormsModule, RouterLink, AvatarModule, ButtonModule, InputTextModule, PasswordModule, ProgressBarModule, RadioButtonModule, SkeletonModule, TagModule, FormFieldComponent, PageHeaderComponent, SaveBarComponent],
    templateUrl: './user-form.component.html'
})
export class UserFormComponent implements OnInit, HasUnsavedChanges {
    private readonly formBuilder = inject(FormBuilder);

    private readonly userService = inject(UserService);

    private readonly authService = inject(AuthService);

    private readonly toastService = inject(ToastService);

    private readonly router = inject(Router);

    private readonly destroyRef = inject(DestroyRef);

    /** Identifier of the user being edited, absent when creating a new one. */
    readonly id = input<number | undefined, unknown>(undefined, { transform: numberAttribute });

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

    protected readonly isLoading = signal(false);

    /** Stored user, only when editing: shows its state and creation date. */
    protected readonly storedUser = signal<UserResponse | null>(null);

    protected readonly isEditing = computed(() => this.id() !== undefined && !Number.isNaN(this.id()));

    /** An administrator cannot change their own role, the backend rejects it too. */
    protected readonly isOwnAccount = computed(() => this.isEditing() && this.id() === this.authService.session()?.userId);

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
    private readonly requiredFields = computed(() => (this.isEditing() ? (['firstName', 'firstLastName', 'email'] as const) : (['firstName', 'firstLastName', 'email', 'password', 'confirmPassword'] as const)));

    protected readonly requiredCount = computed(() => this.requiredFields().length);

    protected readonly completedCount = computed(() => {
        this.formValue();
        return this.requiredFields().filter((field) => this.userForm.controls[field].valid).length;
    });

    protected readonly progress = computed(() => Math.round((this.completedCount() / this.requiredCount()) * 100));

    ngOnInit(): void {
        if (!this.isEditing()) {
            return;
        }
        // Editing: the password is optional and only replaces the stored one when typed.
        this.userForm.controls.password.setValidators([Validators.minLength(MIN_PASSWORD_LENGTH), passwordByteLimit]);
        this.userForm.controls.confirmPassword.clearValidators();
        this.userForm.controls.password.updateValueAndValidity({ emitEvent: false });
        this.userForm.controls.confirmPassword.updateValueAndValidity({ emitEvent: false });

        this.isLoading.set(true);
        this.userService
            .findById(this.id()!)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (user) => {
                    this.storedUser.set(user);
                    this.userForm.reset({ firstName: user.firstName, firstLastName: user.firstLastName, secondLastName: user.secondLastName ?? '', email: user.email, password: '', confirmPassword: '', role: user.role });
                    this.unsaved.markSaved();
                    this.isLoading.set(false);
                },
                error: () => {
                    this.toastService.error('No se encontró el usuario', 'Puede que ya no exista.');
                    void this.router.navigate(['/users']);
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
        const request = this.buildRequest();
        const saved$ = this.isEditing() ? this.userService.update(this.id()!, { ...request, password: request.password || undefined }) : this.userService.create(request);

        saved$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
            next: (user) => {
                this.isSubmitting.set(false);
                this.userForm.patchValue({ password: '', confirmPassword: '' });
                this.unsaved.markSaved();
                // The session is tied to the email: changing one's own email ends it.
                if (this.isOwnAccount() && user.email !== this.storedUser()?.email) {
                    this.toastService.info('Correo actualizado', 'Inicie sesión de nuevo con su nuevo correo.');
                    this.authService.logout();
                    void this.router.navigate(['/auth/login']);
                    return;
                }
                if (this.isEditing()) {
                    this.toastService.success('Usuario actualizado', `${user.firstName} ${user.firstLastName}`);
                } else {
                    this.toastService.success('Usuario creado con éxito', `Enviamos las credenciales de acceso a ${user.email}.`);
                }
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
