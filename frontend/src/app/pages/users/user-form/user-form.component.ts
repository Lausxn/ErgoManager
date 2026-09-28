import { HttpErrorResponse, HttpStatusCode } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, input, numberAttribute, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { AvatarModule } from 'primeng/avatar';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { ProgressBarModule } from 'primeng/progressbar';
import { RadioButtonModule } from 'primeng/radiobutton';
import { TagModule } from 'primeng/tag';

import { HasUnsavedChanges } from '../../../core/guards/unsaved-changes.guard';
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

/** Time the save bar stays in its alert state, a bit longer than the shake. */
const ALERT_DURATION_MS = 900;

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
    templateUrl: './user-form.component.html',
    host: { '(window:beforeunload)': 'onBeforeUnload($event)' }
})
export class UserFormComponent implements OnInit, HasUnsavedChanges {
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

    /** True while the save bar shakes to remind that there are unsaved changes. */
    protected readonly isAlerting = signal(false);

    private alertTimer?: ReturnType<typeof setTimeout>;

    /** Values the form started with: empty when creating, the stored user when editing. */
    private readonly initialValue = signal(this.userForm.getRawValue());

    /**
     * Every value of the form, typed and complete. valueChanges fires after
     * validation, so validity is already current when it emits.
     */
    private readonly formValue = toSignal(this.userForm.valueChanges.pipe(map(() => this.userForm.getRawValue())), { initialValue: this.userForm.getRawValue() });

    /** True when something was typed that would be lost when leaving. */
    protected readonly hasChanges = computed(() => {
        const current = this.formValue();
        const initial = this.initialValue();
        return (Object.keys(initial) as (keyof typeof initial)[]).some((field) => current[field] !== initial[field]);
    });

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

    constructor() {
        this.destroyRef.onDestroy(() => clearTimeout(this.alertTimer));
    }

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
                next: ({ firstName, firstLastName, secondLastName, email, role }) => {
                    this.userForm.patchValue({ firstName, firstLastName, secondLastName: secondLastName ?? '', email, role });
                    this.initialValue.set(this.userForm.getRawValue());
                },
                error: () => {
                    this.toastService.error('No se encontró el usuario', 'Puede que ya no exista.');
                    void this.router.navigate(['/users']);
                }
            });
    }

    /**
     * Called by unsavedChangesGuard before leaving the page. With pending
     * changes it keeps the user here and shakes the save bar, like Discord.
     *
     * @returns true when there is nothing to lose
     */
    canLeave(): boolean {
        if (!this.hasChanges()) {
            return true;
        }
        this.alertUnsavedChanges();
        return false;
    }

    /**
     * Asks the browser to confirm before closing or reloading the tab with
     * unsaved changes. Browsers only allow their own dialog here, so the save
     * bar also shakes and is waiting in its alert state if the user stays.
     *
     * @param event unload event of the window
     */
    protected onBeforeUnload(event: BeforeUnloadEvent): void {
        if (!this.hasChanges()) {
            return;
        }
        event.preventDefault();
        // Safari and older Chromium versions only show the dialog when returnValue is set.
        event.returnValue = true;
        this.alertUnsavedChanges();
    }

    /**
     * Empties the form when creating, or puts the stored values back when
     * editing, and clears the error messages.
     */
    protected resetForm(): void {
        this.userForm.reset(this.initialValue());
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
                this.initialValue.set(this.userForm.getRawValue());
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

    /**
     * Shakes the save bar and paints it in the alert color. Removing the class
     * first and adding it back on the next frame restarts the animation when
     * the user insists.
     */
    private alertUnsavedChanges(): void {
        clearTimeout(this.alertTimer);
        this.isAlerting.set(false);
        requestAnimationFrame(() => {
            this.isAlerting.set(true);
            this.alertTimer = setTimeout(() => this.isAlerting.set(false), ALERT_DURATION_MS);
        });
    }
}
