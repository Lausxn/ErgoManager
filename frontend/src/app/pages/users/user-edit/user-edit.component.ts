import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, input, numberAttribute, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { MessageService } from 'primeng/api';
import { AvatarModule } from 'primeng/avatar';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { DividerModule } from 'primeng/divider';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { PasswordModule } from 'primeng/password';
import { RadioButtonModule } from 'primeng/radiobutton';
import { SkeletonModule } from 'primeng/skeleton';
import { TagModule } from 'primeng/tag';
import { ToggleSwitchModule } from 'primeng/toggleswitch';

import { AuthService } from '../../../core/services/auth.service';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { Role } from '../../../shared/models/role.model';
import { UserRequest, UserResponse } from '../../../shared/models/user.model';
import { isControlInvalid, markFormAsDirty } from '../../../shared/utils/form';
import { ACTIVE_TAG_CLASSES, ROLE_LABELS } from '../../../shared/utils/labels';
import { UserService } from '../user.service';

/** Limits of UserRequestDTO in the backend. */
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 100;
const MAX_NAME_LENGTH = 60;
const MAX_EMAIL_LENGTH = 120;

/** Role card of the form. */
interface RoleCard {
    value: Role;
    label: string;
    description: string;
    icon: string;
}

/** Field changed in the form, listed in the summary before saving. */
interface PendingChange {
    label: string;
    before: string;
    after: string;
}

/**
 * Checks that both passwords of the form match.
 *
 * @param group form holding password and passwordConfirmation
 * @returns passwordMismatch when they differ
 */
function passwordsMatch(group: AbstractControl): ValidationErrors | null {
    const password = group.get('password')?.value;
    const confirmation = group.get('passwordConfirmation')?.value;
    return confirmation && password !== confirmation ? { passwordMismatch: true } : null;
}

/**
 * Dashboard opened from the user management to edit an administrator or an
 * ergonomist. Shows the stored account next to the form, so the administrator
 * sees every change before saving it. The password is only sent when the
 * administrator decides to replace it.
 */
@Component({
    selector: 'app-user-edit',
    standalone: true,
    imports: [
        DatePipe,
        ReactiveFormsModule,
        RouterLink,
        AvatarModule,
        ButtonModule,
        CardModule,
        DividerModule,
        IconFieldModule,
        InputIconModule,
        InputTextModule,
        MessageModule,
        PasswordModule,
        RadioButtonModule,
        SkeletonModule,
        TagModule,
        ToggleSwitchModule,
        PageHeaderComponent
    ],
    templateUrl: './user-edit.component.html'
})
export class UserEditComponent implements OnInit {
    private readonly formBuilder = inject(FormBuilder);

    private readonly userService = inject(UserService);

    private readonly messageService = inject(MessageService);

    private readonly authService = inject(AuthService);

    private readonly router = inject(Router);

    /** Identifier of the user being edited, read from the url. */
    readonly id = input.required<number, unknown>({ transform: numberAttribute });

    protected readonly maxNameLength = MAX_NAME_LENGTH;

    protected readonly maxEmailLength = MAX_EMAIL_LENGTH;

    protected readonly maxPasswordLength = MAX_PASSWORD_LENGTH;

    protected readonly roleLabels = ROLE_LABELS;

    protected readonly activeTagClasses = ACTIVE_TAG_CLASSES;

    protected readonly roleCards: RoleCard[] = [
        { value: 'ADMIN', label: ROLE_LABELS.ADMIN, description: 'Gestiona empresas, usuarios y formularios.', icon: 'pi pi-shield' },
        { value: 'ERGONOMIST', label: ROLE_LABELS.ERGONOMIST, description: 'Realiza evaluaciones personalizadas y gestiona su agenda.', icon: 'pi pi-heart' }
    ];

    protected readonly userForm = this.formBuilder.nonNullable.group(
        {
            firstName: ['', [Validators.required, Validators.maxLength(MAX_NAME_LENGTH)]],
            firstLastName: ['', [Validators.required, Validators.maxLength(MAX_NAME_LENGTH)]],
            secondLastName: ['', [Validators.maxLength(MAX_NAME_LENGTH)]],
            email: ['', [Validators.required, Validators.email, Validators.maxLength(MAX_EMAIL_LENGTH)]],
            changePassword: [false],
            password: [{ value: '', disabled: true }, [Validators.required, Validators.minLength(MIN_PASSWORD_LENGTH), Validators.maxLength(MAX_PASSWORD_LENGTH)]],
            passwordConfirmation: [{ value: '', disabled: true }, [Validators.required]],
            role: ['ERGONOMIST' as Role, [Validators.required]]
        },
        { validators: passwordsMatch }
    );

    /** Raw value, so the role still counts while it is disabled. */
    private readonly formValue = toSignal(this.userForm.valueChanges.pipe(map(() => this.userForm.getRawValue())), { initialValue: this.userForm.getRawValue() });

    /** User as stored in the backend, before any change of the form. */
    protected readonly user = signal<UserResponse | null>(null);

    protected readonly isLoading = signal(true);

    protected readonly loadFailed = signal(false);

    protected readonly isSubmitting = signal(false);

    /** The signed in administrator cannot change their own role and lose access. */
    protected readonly isCurrentUser = computed(() => this.authService.session()?.userId === this.user()?.id);

    protected readonly fullName = computed(() => {
        const user = this.user();
        return user ? [user.firstName, user.firstLastName, user.secondLastName].filter(Boolean).join(' ') : '';
    });

    protected readonly initials = computed(() => {
        const user = this.user();
        return user ? `${user.firstName.charAt(0)}${user.firstLastName.charAt(0)}`.toUpperCase() : '';
    });

    /** Differences between the stored user and the form, shown before saving. */
    protected readonly pendingChangeList = computed<PendingChange[]>(() => {
        const user = this.user();
        if (!user) {
            return [];
        }
        const value = this.formValue();
        const changeList: PendingChange[] = [];
        const compare = (label: string, before: string | undefined, after: string | undefined): void => {
            const beforeText = before?.trim() ?? '';
            const afterText = after?.trim() ?? '';
            if (beforeText !== afterText) {
                changeList.push({ label, before: beforeText || '—', after: afterText || '—' });
            }
        };
        compare('Nombre', user.firstName, value.firstName);
        compare('Primer apellido', user.firstLastName, value.firstLastName);
        compare('Segundo apellido', user.secondLastName, value.secondLastName);
        compare('Correo', user.email, value.email);
        compare('Rol', ROLE_LABELS[user.role], value.role ? ROLE_LABELS[value.role] : undefined);
        if (value.changePassword) {
            changeList.push({ label: 'Contraseña', before: '••••••••', after: 'Nueva contraseña' });
        }
        return changeList;
    });

    ngOnInit(): void {
        this.userForm.controls.changePassword.valueChanges.subscribe((changePassword) => this.togglePasswordFields(changePassword));
        this.loadUser();
    }

    /**
     * Reads the user and fills the form with the stored data.
     */
    protected loadUser(): void {
        this.isLoading.set(true);
        this.loadFailed.set(false);
        this.userService.findById(this.id()).subscribe({
            next: (user) => {
                this.user.set(user);
                this.resetForm();
                this.isLoading.set(false);
            },
            error: () => {
                this.loadFailed.set(true);
                this.isLoading.set(false);
            }
        });
    }

    /**
     * Puts the stored data back in the form, discarding every change.
     */
    protected resetForm(): void {
        const user = this.user();
        if (!user) {
            return;
        }
        this.userForm.reset({
            firstName: user.firstName,
            firstLastName: user.firstLastName,
            secondLastName: user.secondLastName ?? '',
            email: user.email,
            changePassword: false,
            password: '',
            passwordConfirmation: '',
            role: user.role
        });
        if (this.isCurrentUser()) {
            this.userForm.controls.role.disable();
        }
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
     * Checks whether the confirmation has to show that the passwords differ.
     *
     * @returns true when both passwords were typed and do not match
     */
    protected isPasswordMismatch(): boolean {
        const confirmation = this.userForm.controls.passwordConfirmation;
        return this.userForm.hasError('passwordMismatch') && (confirmation.touched || confirmation.dirty);
    }

    /**
     * Sends the changes to the backend. The password is left out when the
     * administrator did not ask to replace it.
     */
    protected submit(): void {
        if (this.userForm.invalid) {
            markFormAsDirty(this.userForm);
            return;
        }
        if (this.pendingChangeList().length === 0) {
            return;
        }

        this.isSubmitting.set(true);
        const { firstName, firstLastName, secondLastName, email, changePassword, password, role } = this.userForm.getRawValue();
        const request: UserRequest = {
            firstName: firstName.trim(),
            firstLastName: firstLastName.trim(),
            secondLastName: secondLastName.trim() || undefined,
            email: email.trim(),
            password: changePassword ? password : undefined,
            role
        };

        this.userService.update(this.id(), request).subscribe({
            next: () => {
                this.isSubmitting.set(false);
                this.messageService.add({ severity: 'success', summary: 'Usuario actualizado', detail: request.email });
                void this.router.navigate(['/users']);
            },
            error: () => {
                this.isSubmitting.set(false);
                this.messageService.add({ severity: 'error', summary: 'No se pudo guardar', detail: 'Revise los datos e intente de nuevo. El correo no puede pertenecer a otro usuario.' });
            }
        });
    }

    /**
     * Enables the password fields only while the administrator wants to replace it.
     *
     * @param changePassword value of the switch
     */
    private togglePasswordFields(changePassword: boolean): void {
        const { password, passwordConfirmation } = this.userForm.controls;
        if (changePassword) {
            password.enable();
            passwordConfirmation.enable();
        } else {
            password.reset('');
            passwordConfirmation.reset('');
            password.disable();
            passwordConfirmation.disable();
        }
    }
}
