import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, input, numberAttribute, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { map, merge } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { DatePickerModule } from 'primeng/datepicker';
import { SelectModule } from 'primeng/select';
import { SkeletonModule } from 'primeng/skeleton';

import { AuthService } from '../../../core/services/auth.service';
import { HasUnsavedChanges } from '../../../core/guards/unsaved-changes.guard';
import { FormFieldComponent } from '../../../shared/components/form-field/form-field.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { SaveBarComponent } from '../../../shared/components/save-bar/save-bar.component';
import { trackUnsavedChanges } from '../../../shared/forms/unsaved-changes';
import { AvailabilityRequest } from '../../../shared/models/appointment.model';
import { ToastService } from '../../../shared/services/toast.service';
import { applyApiErrors, getApiErrorMessage, isConflict } from '../../../shared/utils/api-error';
import { toLocalDateTime } from '../../../shared/utils/date-time';
import { markFormAsDirty } from '../../../shared/utils/form';
import { UserService } from '../../users/user.service';
import { AppointmentService } from '../appointment.service';
import { formatDuration } from '../appointment-utils';

const OVERLAP_MESSAGE = 'Este horario se cruza con otro espacio ya publicado. Elija otra hora.';

/** Ergonomist offered in the selector of the administrator. */
interface ErgonomistOption {
    id: number;
    fullName: string;
    email: string;
}

/**
 * Joins the day and a time picked in separate fields.
 *
 * @param day  date picked in the calendar
 * @param time date whose hours and minutes are used
 * @returns the combined date, or null when a part is missing
 */
function combine(day: Date | null, time: Date | null): Date | null {
    if (!day || !time) {
        return null;
    }
    const result = new Date(day);
    result.setHours(time.getHours(), time.getMinutes(), 0, 0);
    return result;
}

/**
 * Checks that the slot ends after it starts and that it starts in the future.
 *
 * @param group group holding the date and both times
 * @returns the errors, or null when the range is valid
 */
function validateSlot(group: AbstractControl): ValidationErrors | null {
    const date = group.get('date')?.value as Date | null;
    const start = combine(date, group.get('startTime')?.value as Date | null);
    const end = combine(date, group.get('endTime')?.value as Date | null);
    if (!start) {
        return null;
    }
    const errors: ValidationErrors = {};
    if (start.getTime() <= Date.now()) {
        errors['pastStart'] = true;
    }
    if (end && end <= start) {
        errors['invalidRange'] = true;
    }
    return Object.keys(errors).length > 0 ? errors : null;
}

/**
 * Form where an ergonomist, or an administrator on their behalf, publishes a
 * time slot that can be booked for an appointment.
 */
@Component({
    selector: 'app-availability-form',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [DatePipe, ReactiveFormsModule, RouterLink, ButtonModule, DatePickerModule, SelectModule, SkeletonModule, FormFieldComponent, PageHeaderComponent, SaveBarComponent],
    templateUrl: './availability-form.component.html'
})
export class AvailabilityFormComponent implements OnInit, HasUnsavedChanges {
    private readonly formBuilder = inject(FormBuilder);
    private readonly appointmentService = inject(AppointmentService);
    private readonly userService = inject(UserService);
    private readonly authService = inject(AuthService);
    private readonly toastService = inject(ToastService);
    private readonly router = inject(Router);
    private readonly destroyRef = inject(DestroyRef);

    /** Ergonomist to preselect, from the ?userId= query parameter (administrator only). */
    readonly userId = input<number | undefined, unknown>(undefined, { transform: numberAttribute });
    protected readonly isAdmin = computed(() => this.authService.session()?.role === 'ADMIN');

    /** Start of today: earlier days cannot be chosen. */
    protected readonly today = startOfToday();

    protected readonly availabilityForm = this.formBuilder.group(
        {
            userId: this.formBuilder.control<number | null>(null, [Validators.required]),
            date: this.formBuilder.control<Date | null>(null, [Validators.required]),
            startTime: this.formBuilder.control<Date | null>(null, [Validators.required]),
            endTime: this.formBuilder.control<Date | null>(null, [Validators.required])
        },
        { validators: validateSlot }
    );

    protected readonly unsaved = trackUnsavedChanges(this.availabilityForm);
    protected readonly ergonomists = signal<ErgonomistOption[]>([]);
    protected readonly isLoadingErgonomists = signal(false);
    protected readonly errorMessage = signal<string | null>(null);
    protected readonly isSubmitting = signal(false);

    private readonly formValue = toSignal(merge(this.availabilityForm.valueChanges, this.availabilityForm.statusChanges).pipe(map(() => this.availabilityForm.getRawValue())), {
        initialValue: this.availabilityForm.getRawValue()
    });

    /** Slot as it will be published, for the summary on the side. */
    protected readonly preview = computed(() => {
        const { userId, date, startTime, endTime } = this.formValue();
        const start = combine(date, startTime);
        const end = combine(date, endTime);
        const minutes = start && end && end > start ? Math.round((end.getTime() - start.getTime()) / 60000) : null;
        const ergonomistName = this.isAdmin() ? (this.ergonomists().find((ergonomist) => ergonomist.id === userId)?.fullName ?? '') : (this.authService.session()?.fullName ?? '');
        return { ergonomistName, date, start, end, duration: minutes === null ? null : formatDuration(minutes) };
    });

    protected readonly rangeError = computed(() => {
        this.formValue();
        const form = this.availabilityForm;
        if (form.hasError('pastStart') && (form.controls.startTime.dirty || form.controls.date.dirty)) {
            return 'El espacio debe empezar en el futuro.';
        }
        if (form.hasError('invalidRange') && form.controls.endTime.dirty) {
            return 'La hora de fin debe ser posterior a la de inicio.';
        }
        return null;
    });

    ngOnInit(): void {
        if (!this.isAdmin()) {
            this.availabilityForm.controls.userId.setValue(this.authService.session()?.userId ?? null);
            this.unsaved.markSaved();
            return;
        }
        this.loadErgonomists();
    }

    /** Called by unsavedChangesGuard before leaving the page. */
    canLeave(): boolean {
        return this.unsaved.canLeave();
    }

    /** Clears the messages of a failed save after the changes were discarded. */
    protected clearError(): void {
        this.errorMessage.set(null);
    }

    /** Publishes the slot, keeping the values after an error. */
    protected submit(): void {
        if (this.isSubmitting()) {
            return;
        }
        // "In the future" depends on the clock, so it is checked again right before sending.
        this.availabilityForm.updateValueAndValidity();
        const { userId, date, startTime, endTime } = this.availabilityForm.getRawValue();
        const start = combine(date, startTime);
        const end = combine(date, endTime);
        if (this.availabilityForm.invalid || userId === null || !start || !end) {
            markFormAsDirty(this.availabilityForm);
            this.errorMessage.set(this.rangeError() ?? 'Revise los campos marcados antes de publicar.');
            return;
        }

        this.errorMessage.set(null);
        this.isSubmitting.set(true);
        const request: AvailabilityRequest = { userId, startDateTime: toLocalDateTime(start), endDateTime: toLocalDateTime(end) };
        this.appointmentService
            .createAvailability(request)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: () => {
                    this.isSubmitting.set(false);
                    this.unsaved.markSaved();
                    this.toastService.success('Disponibilidad publicada', 'El espacio ya se puede usar para agendar citas.');
                    void this.router.navigate(['/appointments'], this.isAdmin() ? { queryParams: { userId } } : {});
                },
                error: (error: unknown) => {
                    this.isSubmitting.set(false);
                    this.errorMessage.set(isConflict(error) ? getApiErrorMessage(error, OVERLAP_MESSAGE) : applyApiErrors(this.availabilityForm, error, 'No se pudo publicar el espacio. Intente de nuevo.'));
                }
            });
    }

    /** Reads the active ergonomists and preselects the requested one. */
    private loadErgonomists(): void {
        this.isLoadingErgonomists.set(true);
        this.userService
            .findAll()
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (users) => {
                    const ergonomists = users
                        .filter((user) => user.active && user.role === 'ERGONOMIST')
                        .map((user) => ({ id: user.id, fullName: [user.firstName, user.firstLastName, user.secondLastName].filter(Boolean).join(' '), email: user.email }))
                        .sort((a, b) => a.fullName.localeCompare(b.fullName));
                    this.ergonomists.set(ergonomists);
                    this.isLoadingErgonomists.set(false);
                    const preselected = ergonomists.find((ergonomist) => ergonomist.id === this.userId()) ?? (ergonomists.length === 1 ? ergonomists[0] : undefined);
                    if (preselected && this.availabilityForm.pristine) {
                        this.availabilityForm.controls.userId.setValue(preselected.id);
                        this.unsaved.markSaved();
                    }
                },
                error: (error: unknown) => {
                    this.isLoadingErgonomists.set(false);
                    this.errorMessage.set(getApiErrorMessage(error, 'No se pudieron cargar los ergonomistas.'));
                }
            });
    }
}

function startOfToday(): Date {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
}
