import { HttpErrorResponse, HttpStatusCode } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, input, numberAttribute, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AvatarModule } from 'primeng/avatar';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { ProgressBarModule } from 'primeng/progressbar';
import { RadioButtonModule } from 'primeng/radiobutton';
import { TagModule } from 'primeng/tag';

import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { Role } from '../../../shared/models/role.model';
import { UserRequest } from '../../../shared/models/user.model';
import { ToastService } from '../../../shared/services/toast.service';
import { isControlInvalid, markFormAsDirty } from '../../../shared/utils/form';
import { ROLE_LABELS, ROLE_TAG_CLASSES } from '../../../shared/utils/labels';
import { UserService } from '../user.service';

/** Limits of UserRequestDTO in the backend. */
const MAX_NAME_LENGTH = 60;
const MAX_EMAIL_LENGTH = 120;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 100;

/** Rejects values made only of spaces, which required alone lets through. */
const NOT_BLANK = Validators.pattern(/\S/);

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
 * Form used to register a new administrator or ergonomist, or to edit one.
 */
@Component({
    selector: 'app-user-form',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [ReactiveFormsModule, RouterLink, AvatarModule, ButtonModule, InputTextModule, PasswordModule, ProgressBarModule, RadioButtonModule, TagModule, PageHeaderComponent],
    templateUrl: './user-form.component.html'
})
export class UserFormComponent implements OnInit {
    private readonly formBuilder = inject(FormBuilder);

    private readonly userService = inject(UserService);

    private readonly toastService = inject(ToastService);

    private readonly router = inject(Router);

    private readonly destroyRef = inject(DestroyRef);

    /** Identifier of the user being edited, absent when creating a new one. */
    readonly id = input<number | undefined, unknown>(undefined, { transform: numberAttribute });

    protected readonly limits = { name: MAX_NAME_LENGTH, email: MAX_EMAIL_LENGTH, password: MAX_PASSWORD_LENGTH };

    protected readonly roleLabels = ROLE_LABELS;

    protected readonly roleTagClasses = ROLE_TAG_CLASSES;

    /** Roles offered in the form, with what each one allows. */
    protected readonly roleChoices: { value: Role; description: string; icon: string }[] = [
        { value: 'ERGONOMIST', description: 'Realiza evaluaciones personalizadas y gestiona su propia agenda.', icon: 'pi pi-heart' },
        { value: 'ADMIN', description: 'Acceso completo: gestiona empresas, usuarios y formularios.', icon: 'pi pi-shield' }
    ];

    protected readonly userForm = this.formBuilder.nonNullable.group(
        {
            firstName: ['', [Validators.required, NOT_BLANK, Validators.maxLength(MAX_NAME_LENGTH)]],
            firstLastName: ['', [Validators.required, NOT_BLANK, Validators.maxLength(MAX_NAME_LENGTH)]],
            secondLastName: ['', [Validators.maxLength(MAX_NAME_LENGTH)]],
            email: ['', [Validators.required, Validators.email, Validators.maxLength(MAX_EMAIL_LENGTH)]],
            password: ['', [Validators.required, Validators.minLength(MIN_PASSWORD_LENGTH), Validators.maxLength(MAX_PASSWORD_LENGTH)]],
            confirmPassword: ['', [Validators.required]],
            role: ['ERGONOMIST' as Role, [Validators.required]]
        },
        { validators: passwordsMatch }
    );

    protected readonly isSubmitting = signal(false);

    protected readonly isEditing = signal(false);

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

    ngOnInit(): void {
        const userId = this.id();
        if (userId === undefined || Number.isNaN(userId)) {
            return;
        }
        this.isEditing.set(true);
        this.userService
            .findById(userId)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: ({ firstName, firstLastName, secondLastName, email, role }) => this.userForm.patchValue({ firstName, firstLastName, secondLastName: secondLastName ?? '', email, role }),
                error: () => {
                    this.toastService.error('No se encontró el usuario', 'Puede que ya no exista.');
                    void this.router.navigate(['/users']);
                }
            });
    }

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
     * Sends the form to the backend, creating or updating the user.
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
        const request = this.buildRequest();
        const userId = this.id();
        const saved$ = this.isEditing() && userId !== undefined ? this.userService.update(userId, request) : this.userService.create(request);

        saved$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
            next: () => {
                this.isSubmitting.set(false);
                this.toastService.success(this.isEditing() ? 'Usuario actualizado' : 'Usuario creado', request.email);
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
                this.toastService.error('No se pudo guardar', 'Revise los datos e intente de nuevo.');
            }
        });
    }

    /**
     * Builds the body of the request with clean values: trimmed names, email in
     * lower case, no empty second last name and without the confirmation.
     *
     * @returns body for POST or PUT /api/users
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
