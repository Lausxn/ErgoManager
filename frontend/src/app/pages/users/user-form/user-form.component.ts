import { Component, OnInit, computed, inject, input, numberAttribute, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
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
import { TagModule } from 'primeng/tag';

import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { Role } from '../../../shared/models/role.model';
import { UserRequest } from '../../../shared/models/user.model';
import { isControlInvalid, markFormAsDirty } from '../../../shared/utils/form';
import { ROLE_LABELS } from '../../../shared/utils/labels';
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
 * Screen used to register a new administrator or ergonomist, or to edit one.
 * Groups the data asked to identify the user, their access and their role,
 * and shows a summary of the account while it is typed.
 */
@Component({
    selector: 'app-user-form',
    standalone: true,
    imports: [
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
        TagModule,
        PageHeaderComponent
    ],
    templateUrl: './user-form.component.html'
})
export class UserFormComponent implements OnInit {
    private readonly formBuilder = inject(FormBuilder);

    private readonly userService = inject(UserService);

    private readonly messageService = inject(MessageService);

    private readonly router = inject(Router);

    /** Identifier of the user being edited, absent when creating a new one. */
    readonly id = input<number | undefined, unknown>(undefined, { transform: numberAttribute });

    protected readonly maxNameLength = MAX_NAME_LENGTH;

    protected readonly maxEmailLength = MAX_EMAIL_LENGTH;

    protected readonly maxPasswordLength = MAX_PASSWORD_LENGTH;

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
            password: ['', [Validators.required, Validators.minLength(MIN_PASSWORD_LENGTH), Validators.maxLength(MAX_PASSWORD_LENGTH)]],
            passwordConfirmation: ['', [Validators.required]],
            role: ['ERGONOMIST' as Role, [Validators.required]]
        },
        { validators: passwordsMatch }
    );

    private readonly formValue = toSignal(this.userForm.valueChanges, { initialValue: this.userForm.getRawValue() });

    /** Name shown in the summary card while the form is typed. */
    protected readonly previewName = computed(() => {
        const { firstName, firstLastName, secondLastName } = this.formValue();
        return [firstName, firstLastName, secondLastName].map((part) => part?.trim()).filter(Boolean).join(' ');
    });

    protected readonly previewInitials = computed(() => {
        const { firstName, firstLastName } = this.formValue();
        return `${firstName?.trim().charAt(0) ?? ''}${firstLastName?.trim().charAt(0) ?? ''}`.toUpperCase();
    });

    protected readonly previewEmail = computed(() => this.formValue().email?.trim() ?? '');

    protected readonly previewRole = computed(() => ROLE_LABELS[this.formValue().role ?? 'ERGONOMIST']);

    protected readonly isSubmitting = signal(false);

    protected readonly isEditing = signal(false);

    ngOnInit(): void {
        const userId = this.id();
        if (userId === undefined || Number.isNaN(userId)) {
            return;
        }
        this.isEditing.set(true);
        this.userService.findById(userId).subscribe((user) => this.userForm.patchValue(user));
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
     * Sends the form to the backend, creating or updating the user.
     */
    protected submit(): void {
        if (this.userForm.invalid) {
            markFormAsDirty(this.userForm);
            return;
        }

        this.isSubmitting.set(true);
        const { firstName, firstLastName, secondLastName, email, password, role } = this.userForm.getRawValue();
        const request: UserRequest = { firstName, firstLastName, secondLastName: secondLastName || undefined, email, password, role };
        const userId = this.id();
        const saved$ = this.isEditing() && userId !== undefined ? this.userService.update(userId, request) : this.userService.create(request);

        saved$.subscribe({
            next: () => {
                this.isSubmitting.set(false);
                this.messageService.add({ severity: 'success', summary: this.isEditing() ? 'Usuario actualizado' : 'Usuario creado', detail: request.email });
                void this.router.navigate(['/users']);
            },
            error: () => {
                this.isSubmitting.set(false);
                this.messageService.add({ severity: 'error', summary: 'No se pudo guardar', detail: 'Revise los datos e intente de nuevo. El correo no puede estar registrado.' });
            }
        });
    }
}
