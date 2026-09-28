import { DatePipe } from '@angular/common';
import { HttpErrorResponse, HttpStatusCode } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, input, numberAttribute, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { AvatarModule } from 'primeng/avatar';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import { TagModule } from 'primeng/tag';

import { AuthService } from '../../../core/services/auth.service';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { UserResponse } from '../../../shared/models/user.model';
import { ToastService } from '../../../shared/services/toast.service';
import { markFormAsDirty } from '../../../shared/utils/form';
import { ACTIVE_TAG_CLASSES, ROLE_LABELS, ROLE_TAG_CLASSES } from '../../../shared/utils/labels';
import { createIdentityControls, toIdentityRequest } from '../shared/user-fields';
import { UserIdentityFieldsComponent } from '../shared/user-identity-fields.component';
import { UserRoleFieldComponent } from '../shared/user-role-field.component';
import { UserService } from '../user.service';

const CONNECTION_ERROR = 'No fue posible conectar con el servidor. Revise su conexión e intente de nuevo.';

/**
 * Edition of an administrator or ergonomist: shows the stored information of
 * the user next to the form to change the names, the email and the role. The
 * password is not edited here, UserUpdateRequestDTO does not carry it.
 */
@Component({
    selector: 'app-user-edit',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [DatePipe, ReactiveFormsModule, RouterLink, AvatarModule, ButtonModule, SkeletonModule, TagModule, PageHeaderComponent, UserIdentityFieldsComponent, UserRoleFieldComponent],
    templateUrl: './user-edit.component.html'
})
export class UserEditComponent implements OnInit {
    private readonly userService = inject(UserService);

    private readonly authService = inject(AuthService);

    private readonly toastService = inject(ToastService);

    private readonly router = inject(Router);

    private readonly destroyRef = inject(DestroyRef);

    /** Identifier of the user, taken from the route. */
    readonly id = input.required<number, unknown>({ transform: numberAttribute });

    protected readonly roleLabels = ROLE_LABELS;

    protected readonly roleTagClasses = ROLE_TAG_CLASSES;

    protected readonly activeTagClasses = ACTIVE_TAG_CLASSES;

    protected readonly userForm = new FormGroup(createIdentityControls());

    /** User as stored in the backend; the form is compared against it. */
    protected readonly user = signal<UserResponse | null>(null);

    protected readonly isSaving = signal(false);

    /** Every value of the form, typed and complete, updated on each change. */
    private readonly formValue = toSignal(this.userForm.valueChanges.pipe(map(() => this.userForm.getRawValue())), { initialValue: this.userForm.getRawValue() });

    protected readonly selectedRole = computed(() => this.formValue().role);

    protected readonly profile = computed(() => {
        const user = this.user();
        if (user === null) {
            return null;
        }
        return {
            fullName: [user.firstName, user.firstLastName, user.secondLastName].filter(Boolean).join(' '),
            initials: `${user.firstName.charAt(0)}${user.firstLastName.charAt(0)}`.toUpperCase(),
            isOwnAccount: this.authService.session()?.userId === user.id
        };
    });

    /** True when the form holds something different from the stored user. */
    protected readonly hasChanges = computed(() => {
        const user = this.user();
        if (user === null) {
            return false;
        }
        const edited = toIdentityRequest(this.formValue());
        return edited.firstName !== user.firstName || edited.firstLastName !== user.firstLastName || (edited.secondLastName ?? '') !== (user.secondLastName ?? '') || edited.email !== user.email.toLowerCase() || edited.role !== user.role;
    });

    protected readonly isRoleChanged = computed(() => {
        const user = this.user();
        return user !== null && this.selectedRole() !== user.role;
    });

    ngOnInit(): void {
        this.userService
            .findById(this.id())
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (user) => this.showUser(user),
                error: (error: HttpErrorResponse) => {
                    const detail = error.status === 0 ? CONNECTION_ERROR : 'Puede que ya no exista.';
                    this.toastService.error('No se encontró el usuario', detail);
                    void this.router.navigate(['/users']);
                }
            });
    }

    /**
     * Puts the stored values back in the form, dropping what was typed.
     */
    protected discardChanges(): void {
        const user = this.user();
        if (user !== null) {
            this.showUser(user);
        }
    }

    /**
     * Sends the changes to the backend.
     */
    protected submit(): void {
        const user = this.user();
        if (user === null || this.isSaving() || !this.hasChanges()) {
            return;
        }
        if (this.userForm.invalid) {
            markFormAsDirty(this.userForm);
            return;
        }

        this.isSaving.set(true);
        const request = toIdentityRequest(this.userForm.getRawValue());

        this.userService
            .update(user.id, request)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (updated) => {
                    this.isSaving.set(false);
                    this.toastService.success('Usuario actualizado', updated.email);
                    void this.router.navigate(['/users']);
                },
                error: (error: HttpErrorResponse) => {
                    this.isSaving.set(false);
                    this.handleSaveError(error, user);
                }
            });
    }

    /**
     * Loads a user in the page and leaves the form untouched.
     *
     * @param user user returned by the backend
     */
    private showUser(user: UserResponse): void {
        this.user.set(user);
        this.userForm.reset({
            firstName: user.firstName,
            firstLastName: user.firstLastName,
            secondLastName: user.secondLastName ?? '',
            email: user.email,
            role: user.role
        });
    }

    /**
     * Explains why the backend rejected the changes.
     *
     * @param error answer of the backend
     * @param user  user as it was before the changes
     */
    private handleSaveError(error: HttpErrorResponse, user: UserResponse): void {
        switch (error.status) {
            case HttpStatusCode.Conflict: {
                const email = this.userForm.controls.email;
                email.setErrors({ duplicated: true });
                email.markAsTouched();
                return;
            }
            case HttpStatusCode.BadRequest:
                if (user.role === 'ADMIN' && this.selectedRole() === 'ERGONOMIST') {
                    this.toastService.error('No se puede cambiar el rol', 'Es el único administrador activo. Asigne otro administrador antes de cambiarlo.');
                    return;
                }
                this.toastService.error('No se pudo guardar', 'Revise los datos e intente de nuevo.');
                return;
            case HttpStatusCode.NotFound:
                this.toastService.error('No se encontró el usuario', 'Puede que ya no exista.');
                void this.router.navigate(['/users']);
                return;
            case 0:
                this.toastService.error('No se pudo guardar', CONNECTION_ERROR);
                return;
            default:
                this.toastService.error('No se pudo guardar', 'Intente de nuevo en unos minutos.');
        }
    }
}
