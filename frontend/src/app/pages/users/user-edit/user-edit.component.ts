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

import { HasUnsavedChanges } from '../../../core/guards/unsaved-changes.guard';
import { SESSION_MESSAGE_STATE_KEY } from '../../../core/interceptors/error.interceptor';
import { AuthService } from '../../../core/services/auth.service';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ApiError } from '../../../shared/models/api-error.model';
import { UserResponse } from '../../../shared/models/user.model';
import { ToastService } from '../../../shared/services/toast.service';
import { markFormAsDirty } from '../../../shared/utils/form';
import { ACTIVE_TAG_CLASSES, ROLE_LABELS, ROLE_TAG_CLASSES } from '../../../shared/utils/labels';
import { createIdentityControls, toIdentityRequest } from '../shared/user-fields';
import { UserIdentityFieldsComponent } from '../shared/user-identity-fields.component';
import { UserRoleFieldComponent } from '../shared/user-role-field.component';
import { UserService } from '../user.service';

const CONNECTION_ERROR = 'No fue posible conectar con el servidor. Revise su conexión e intente de nuevo.';

/** Time the save bar stays in its alert state, a bit longer than the shake. */
const ALERT_DURATION_MS = 900;

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
    templateUrl: './user-edit.component.html',
    host: { '(window:beforeunload)': 'onBeforeUnload($event)' }
})
export class UserEditComponent implements OnInit, HasUnsavedChanges {
    private readonly userService = inject(UserService);

    private readonly authService = inject(AuthService);

    private readonly toastService = inject(ToastService);

    private readonly router = inject(Router);

    private readonly destroyRef = inject(DestroyRef);

    /** Identifier of the user, taken from the route. */
    readonly id = input.required<number, unknown>({
        transform: numberAttribute
    });

    protected readonly roleLabels = ROLE_LABELS;

    protected readonly roleTagClasses = ROLE_TAG_CLASSES;

    protected readonly activeTagClasses = ACTIVE_TAG_CLASSES;

    protected readonly userForm = new FormGroup(createIdentityControls());

    /** User as stored in the backend; the form is compared against it. */
    protected readonly user = signal<UserResponse | null>(null);

    protected readonly isSaving = signal(false);

    /** True while the save bar shakes to remind that there are unsaved changes. */
    protected readonly isAlerting = signal(false);

    private alertTimer?: ReturnType<typeof setTimeout>;

    /** Every value of the form, typed and complete, updated on each change. */
    private readonly formValue = toSignal(this.userForm.valueChanges.pipe(map(() => this.userForm.getRawValue())), {
        initialValue: this.userForm.getRawValue()
    });

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

    constructor() {
        this.destroyRef.onDestroy(() => clearTimeout(this.alertTimer));
    }

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
     * Called by unsavedChangesGuard before leaving the page. With pending
     * changes it keeps the user here and shakes the save bar, like Discord.
     *
     * @returns true when there is nothing to save
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
     * unsaved changes.
     *
     * @param event unload event of the window
     */
    protected onBeforeUnload(event: BeforeUnloadEvent): void {
        if (this.hasChanges()) {
            event.preventDefault();
        }
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

        const ownRoleChange = this.profile()?.isOwnAccount === true && this.isRoleChanged();

        this.userService
            .update(user.id, request)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (updated) => {
                    this.isSaving.set(false);

                    if (ownRoleChange) {
                        this.authService.logout();

                        void this.router.navigate(['/auth/login'], {
                            state: {
                                [SESSION_MESSAGE_STATE_KEY]: 'Su rol fue actualizado. Inicie sesión nuevamente para aplicar sus nuevos permisos.'
                            }
                        });

                        return;
                    }

                    this.showUser(updated);

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
     * @param user user as it was before the changes
     */
    private handleSaveError(error: HttpErrorResponse, _user: UserResponse): void {
        const apiMessage = (error.error as ApiError | null)?.message;

        switch (error.status) {
            case HttpStatusCode.Conflict: {
                const email = this.userForm.controls.email;

                email.setErrors({
                    duplicated: true
                });

                email.markAsTouched();

                return;
            }

            case HttpStatusCode.BadRequest:
                this.toastService.error('No se pudo guardar', apiMessage ?? 'Revise los datos e intente de nuevo.');

                return;

            case HttpStatusCode.NotFound:
                this.toastService.error('No se encontró el usuario', apiMessage ?? 'Puede que ya no exista.');

                this.user.set(null);

                void this.router.navigate(['/users']);

                return;

            case 0:
                this.toastService.error('No se pudo guardar', CONNECTION_ERROR);

                return;

            default:
                this.toastService.error('No se pudo guardar', apiMessage ?? 'Intente de nuevo en unos minutos.');
        }
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
