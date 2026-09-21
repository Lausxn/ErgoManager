import { Component, OnInit, inject, input, numberAttribute, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { SelectModule } from 'primeng/select';

import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { Role } from '../../../shared/models/role.model';
import { UserRequest } from '../../../shared/models/user.model';
import { isControlInvalid, markFormAsDirty } from '../../../shared/utils/form';
import { ROLE_LABELS, toEnumOptions } from '../../../shared/utils/labels';
import { UserService } from '../user.service';

const MIN_PASSWORD_LENGTH = 8;

/**
 * Form used to register a new administrator or ergonomist, or to edit one.
 */
@Component({
    selector: 'app-user-form',
    standalone: true,
    imports: [ReactiveFormsModule, RouterLink, ButtonModule, InputTextModule, PasswordModule, SelectModule, PageHeaderComponent],
    templateUrl: './user-form.component.html'
})
export class UserFormComponent implements OnInit {
    private readonly formBuilder = inject(FormBuilder);

    private readonly userService = inject(UserService);

    private readonly messageService = inject(MessageService);

    private readonly router = inject(Router);

    /** Identifier of the user being edited, absent when creating a new one. */
    readonly id = input<number | undefined, unknown>(undefined, { transform: numberAttribute });

    protected readonly roleOptions = toEnumOptions(ROLE_LABELS);

    protected readonly userForm = this.formBuilder.nonNullable.group({
        firstName: ['', [Validators.required]],
        firstLastName: ['', [Validators.required]],
        secondLastName: [''],
        email: ['', [Validators.required, Validators.email]],
        password: ['', [Validators.required, Validators.minLength(MIN_PASSWORD_LENGTH)]],
        role: ['ERGONOMIST' as Role, [Validators.required]]
    });

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
     * Sends the form to the backend, creating or updating the user.
     */
    protected submit(): void {
        if (this.userForm.invalid) {
            markFormAsDirty(this.userForm);
            return;
        }

        this.isSubmitting.set(true);
        const request: UserRequest = this.userForm.getRawValue();
        const userId = this.id();
        const saved$ = this.isEditing() && userId !== undefined ? this.userService.update(userId, request) : this.userService.create(request);

        saved$.subscribe({
            next: () => {
                this.isSubmitting.set(false);
                this.messageService.add({ severity: 'success', summary: 'Usuario guardado', detail: request.email });
                void this.router.navigate(['/users']);
            },
            error: () => {
                this.isSubmitting.set(false);
                this.messageService.add({ severity: 'error', summary: 'No se pudo guardar', detail: 'Revise los datos e intente de nuevo.' });
            }
        });
    }
}
