import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, LOCALE_ID, OnInit, computed, inject, input, numberAttribute, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormArray, FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Observable, Subscription, catchError, concatMap, forkJoin, from, map, merge, of, toArray } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { DatePickerModule } from 'primeng/datepicker';
import { SelectModule } from 'primeng/select';
import { SkeletonModule } from 'primeng/skeleton';
import { TooltipModule } from 'primeng/tooltip';

import { AuthService } from '../../../core/services/auth.service';
import { HasUnsavedChanges } from '../../../core/guards/unsaved-changes.guard';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { FormFieldComponent } from '../../../shared/components/form-field/form-field.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { SaveBarComponent } from '../../../shared/components/save-bar/save-bar.component';
import { StatCardComponent } from '../../../shared/components/stat-card/stat-card.component';
import { trackUnsavedChanges } from '../../../shared/forms/unsaved-changes';
import { AppointmentResponse, AvailabilityResponse } from '../../../shared/models/appointment.model';
import { DialogService } from '../../../shared/services/dialog.service';
import { ToastService } from '../../../shared/services/toast.service';
import { getApiErrorMessage } from '../../../shared/utils/api-error';
import { toLocalDateTime } from '../../../shared/utils/date-time';
import { markFormAsDirty } from '../../../shared/utils/form';
import { APPOINTMENT_STATUS_LABELS } from '../../../shared/utils/labels';
import { UserService } from '../../users/user.service';
import { AppointmentService } from '../appointment.service';
import { ErgonomistOption, agendaOwnersOf, formatDuration, timeOfDay, timeRangeParts } from '../appointment-utils';
import { AvailabilityEditDialogComponent } from './availability-edit-dialog.component';
import {
    ConfiguredDay,
    PROBLEM_LABELS,
    PlannedDay,
    RANGE_PRESETS,
    SLOT_LENGTH_OPTIONS,
    bookedOf,
    configuredDaysOf,
    failureReason,
    formatSlot,
    formatTimes,
    planDays,
    rangeMinutes,
    requireDates,
    startOfToday,
    takenByDay,
    validateRange
} from './availability-planning';

/** Time range typed in the form, before being split into slots. */
type RangeGroup = FormGroup<{ startTime: FormControl<Date | null>; endTime: FormControl<Date | null> }>;

/**
 * Availability management of an ergonomist (HU-016): a month calendar with the
 * days that already have slots, a form that publishes several days and ranges
 * at once, checking overlaps before sending, and the list of the configured
 * slots, which can be removed one by one or by day. The administrator works on
 * behalf of the ergonomist they choose.
 */
@Component({
    selector: 'app-availability-form',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        DatePipe,
        ReactiveFormsModule,
        RouterLink,
        ButtonModule,
        DatePickerModule,
        SelectModule,
        SkeletonModule,
        TooltipModule,
        AvailabilityEditDialogComponent,
        EmptyStateComponent,
        FormFieldComponent,
        PageHeaderComponent,
        SaveBarComponent,
        StatCardComponent
    ],
    templateUrl: './availability-form.component.html',
    styleUrl: './availability-form.component.scss'
})
export class AvailabilityFormComponent implements OnInit, HasUnsavedChanges {
    private readonly formBuilder = inject(FormBuilder);
    private readonly appointmentService = inject(AppointmentService);
    private readonly userService = inject(UserService);
    private readonly authService = inject(AuthService);
    private readonly dialogService = inject(DialogService);
    private readonly toastService = inject(ToastService);
    private readonly destroyRef = inject(DestroyRef);
    private readonly locale = inject(LOCALE_ID);

    /** Ergonomist to preselect, from the ?userId= query parameter (administrator only). */
    readonly userId = input<number | undefined, unknown>(undefined, { transform: numberAttribute });
    protected readonly isAdmin = computed(() => this.authService.session()?.role === 'ADMIN');

    /** Start of today: earlier days cannot be chosen. */
    protected readonly today = startOfToday();
    protected readonly presets = RANGE_PRESETS;
    protected readonly slotLengthOptions = SLOT_LENGTH_OPTIONS;
    protected readonly problemLabels = PROBLEM_LABELS;
    protected readonly statusLabels = APPOINTMENT_STATUS_LABELS;

    protected readonly availabilityForm = this.formBuilder.group({
        userId: this.formBuilder.control<number | null>(null, [Validators.required]),
        dates: this.formBuilder.nonNullable.control<Date[]>([], [requireDates]),
        slotMinutes: this.formBuilder.control<number | null>(null),
        ranges: this.formBuilder.array<RangeGroup>([this.buildRange(8, 12)])
    });

    protected readonly unsaved = trackUnsavedChanges(this.availabilityForm, {
        restore: (snapshot) => {
            this.ranges.clear({ emitEvent: false });
            for (const range of snapshot.ranges) {
                this.ranges.push(this.buildRange(range.startTime, range.endTime), { emitEvent: false });
            }
            this.availabilityForm.reset(snapshot);
        }
    });

    protected readonly ergonomists = signal<ErgonomistOption[]>([]);
    protected readonly isLoadingErgonomists = signal(false);
    protected readonly errorMessage = signal<string | null>(null);
    protected readonly isSubmitting = signal(false);

    /** Month shown by the calendar, month from 1 to 12. */
    protected readonly visibleMonth = signal({ year: this.today.getFullYear(), month: this.today.getMonth() + 1 });
    protected readonly freeSlots = signal<AvailabilityResponse[]>([]);
    private readonly appointments = signal<AppointmentResponse[]>([]);
    private readonly loadedMonths = new Set<string>();
    protected readonly isLoadingMonth = signal(false);
    protected readonly monthError = signal<string | null>(null);
    protected readonly deletingKeys = signal<ReadonlySet<string>>(new Set());
    private monthRequest?: Subscription;

    /** Free slot the edit dialog changes; null while it is closed. */
    protected readonly editingSlot = signal<AvailabilityResponse | null>(null);

    protected readonly formValue = toSignal(merge(this.availabilityForm.valueChanges, this.availabilityForm.statusChanges).pipe(map(() => this.availabilityForm.getRawValue())), {
        initialValue: this.availabilityForm.getRawValue()
    });

    /** First day of the visible month, for its title. */
    protected readonly monthDate = computed(() => new Date(this.visibleMonth().year, this.visibleMonth().month - 1, 1));

    /**
     * Published slots and booked appointments indexed by the days they touch,
     * so each planned slot is only compared with the ones of its own day.
     */
    private readonly takenIndex = computed(() => takenByDay(this.freeSlots(), this.bookedAppointments()));

    protected get ranges(): FormArray<RangeGroup> {
        return this.availabilityForm.controls.ranges;
    }

    protected readonly ergonomistName = computed(() => {
        if (!this.isAdmin()) {
            return this.authService.session()?.fullName ?? '';
        }
        const id = this.formValue().userId;
        return this.ergonomists().find((ergonomist) => ergonomist.id === id)?.fullName ?? '';
    });

    /** Appointments that still hold their slot: every status but cancelled. */
    protected readonly bookedAppointments = computed(() => bookedOf(this.appointments()));

    /** Free and booked counts per day, for the markers of the calendar. */
    protected readonly dayMarkers = computed(() => {
        const markers = new Map<string, { free: number; booked: number }>();
        const add = (start: string, kind: 'free' | 'booked') => {
            const key = start.slice(0, 10);
            const marker = markers.get(key) ?? { free: 0, booked: 0 };
            marker[kind]++;
            markers.set(key, marker);
        };
        this.freeSlots().forEach((slot) => add(slot.startDateTime, 'free'));
        this.bookedAppointments().forEach((appointment) => add(appointment.startDateTime, 'booked'));
        return markers;
    });

    /**
     * Slots the form would publish: every picked day times every range, cut in
     * appointments of the chosen length, each one checked against the slots
     * already published, the booked appointments and the rest of the selection.
     */
    protected readonly plannedDays = computed<PlannedDay[]>(() => {
        const { dates, ranges, slotMinutes } = this.formValue();
        return planDays(dates, ranges, slotMinutes, this.takenIndex(), Date.now());
    });

    protected readonly plannedSummary = computed(() => {
        const summary = { valid: 0, blocked: 0 };
        for (const day of this.plannedDays()) {
            for (const slot of day.slots) {
                if (slot.problem === null) {
                    summary.valid++;
                } else {
                    summary.blocked++;
                }
            }
        }
        return summary;
    });

    protected readonly previewLead = computed(() => {
        const { valid, blocked } = this.plannedSummary();
        const published = valid === 1 ? '1 espacio se publicará.' : `${valid} espacios se publicarán.`;
        if (blocked === 0) {
            return published;
        }
        return `${published} ${blocked === 1 ? '1 no se puede habilitar porque ya pasó o se cruza' : `${blocked} no se pueden habilitar porque ya pasaron o se cruzan`} con otro horario.`;
    });

    protected readonly publishLabel = computed(() => {
        const valid = this.plannedSummary().valid;
        return valid === 0 ? 'Publicar' : valid === 1 ? 'Publicar 1 espacio' : `Publicar ${valid} espacios`;
    });

    /** Ranges cut into appointments leave minutes over when the length does not fit exactly. */
    protected readonly leftoverWarning = computed(() => {
        const { ranges, slotMinutes } = this.formValue();
        if (slotMinutes === null) {
            return null;
        }
        const wasted = ranges.some((range) => {
            const minutes = rangeMinutes(range.startTime, range.endTime);
            return minutes !== null && minutes % slotMinutes !== 0;
        });
        return wasted ? `Algunos rangos no son múltiplos de ${formatDuration(slotMinutes)}: los minutos que sobran al final no se publican.` : null;
    });

    /** Days of the visible month that already have free slots or booked appointments. */
    protected readonly configuredDays = computed<ConfiguredDay[]>(() => {
        const { year, month } = this.visibleMonth();
        return configuredDaysOf(this.freeSlots(), this.bookedAppointments(), year, month, this.today);
    });

    protected readonly monthSummary = computed(() => {
        const summary = { free: 0, booked: 0, days: 0 };
        for (const day of this.configuredDays()) {
            summary.days++;
            for (const entry of day.entries) {
                if (entry.slot) {
                    summary.free++;
                } else {
                    summary.booked++;
                }
            }
        }
        return summary;
    });

    ngOnInit(): void {
        if (!this.isAdmin()) {
            this.availabilityForm.controls.userId.setValue(this.authService.session()?.userId ?? null);
            this.unsaved.markSaved();
            this.loadMonth();
            return;
        }
        this.loadErgonomists();
        // The calendar data belongs to one ergonomist: switching drops what was read before.
        this.availabilityForm.controls.userId.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.resetCalendarData());
    }

    /** Called by unsavedChangesGuard before leaving the page. */
    canLeave(): boolean {
        return this.unsaved.canLeave();
    }

    /** Clears the messages of a failed save after the changes were discarded. */
    protected clearError(): void {
        this.errorMessage.set(null);
    }

    /**
     * Follows the month shown by the calendar and reads it when it is new.
     *
     * @param event month (1 to 12) and year shown
     */
    protected changeMonth(event: { month?: number; year?: number }): void {
        if (event.month === undefined || event.year === undefined) {
            return;
        }
        this.visibleMonth.set({ year: event.year, month: event.month });
        this.loadMonth();
    }

    /**
     * Markers of a calendar day: free slots and booked appointments.
     *
     * @param date day as described by the PrimeNG calendar (month from 0)
     * @returns the counts, or undefined when the day is empty
     */
    protected markerOf(date: { day: number; month: number; year: number }): { free: number; booked: number } | undefined {
        return this.dayMarkers().get(`${date.year}-${String(date.month + 1).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`);
    }

    /**
     * Time range of a slot with its a. m. or p. m., for the cards, split in its
     * two sides so a narrow card breaks the line between them.
     *
     * @param start beginning of the slot
     * @param end   end of the slot
     */
    protected timeRange(start: Date | string, end: Date | string): [string, string] {
        return timeRangeParts(start, end, this.locale);
    }

    protected addRange(): void {
        const last = this.ranges.at(this.ranges.length - 1)?.getRawValue();
        const startHour = last?.endTime ? Math.min(last.endTime.getHours() + 1, 22) : 8;
        this.ranges.push(this.buildRange(startHour, Math.min(startHour + 2, 23)));
    }

    protected removeRange(index: number): void {
        if (this.ranges.length > 1) {
            this.ranges.removeAt(index);
        }
    }

    /**
     * Replaces the ranges with a ready made set of working hours.
     *
     * @param preset ranges to use, as [start hour, end hour]
     */
    protected applyPreset(preset: (typeof RANGE_PRESETS)[number]): void {
        this.ranges.clear();
        for (const [start, end] of preset.ranges) {
            this.ranges.push(this.buildRange(start, end));
        }
    }

    protected clearDates(): void {
        this.availabilityForm.controls.dates.setValue([]);
    }

    /**
     * Tells whether a range has to show its "end after start" message.
     *
     * @param index position of the range
     */
    protected isRangeInvalid(index: number): boolean {
        const range = this.ranges.at(index);
        return range.hasError('invalidRange') && (range.dirty || range.touched);
    }

    /** Publishes every slot without problems, one request after another. */
    protected submit(): void {
        if (this.isSubmitting()) {
            return;
        }
        const userId = this.availabilityForm.controls.userId.value;
        if (this.availabilityForm.invalid || userId === null) {
            markFormAsDirty(this.availabilityForm);
            this.errorMessage.set(this.availabilityForm.controls.dates.invalid ? 'Elija al menos un día en el calendario.' : 'Revise los campos marcados antes de publicar.');
            return;
        }
        const planned = this.plannedDays().flatMap((day) => day.slots);
        const valid = planned.filter((slot) => slot.problem === null);
        if (valid.length === 0) {
            this.errorMessage.set(planned.length === 0 ? 'Los rangos elegidos no generan ningún espacio.' : 'Ninguno de los espacios se puede publicar: todos ya pasaron o se cruzan con otro horario.');
            return;
        }

        this.errorMessage.set(null);
        this.isSubmitting.set(true);
        const skipped = planned.length - valid.length;
        from(valid)
            .pipe(
                concatMap((slot) =>
                    this.appointmentService.createAvailability({ userId, startDateTime: toLocalDateTime(slot.start), endDateTime: toLocalDateTime(slot.end) }).pipe(
                        map((created) => ({ slot, created, error: null as unknown })),
                        catchError((error: unknown) => of({ slot, created: null, error }))
                    )
                ),
                toArray(),
                takeUntilDestroyed(this.destroyRef)
            )
            .subscribe((results) => {
                this.isSubmitting.set(false);
                const created = results.flatMap((result) => (result.created ? [result.created] : []));
                const failed = results.filter((result) => !result.created);
                if (created.length > 0) {
                    this.freeSlots.update((slots) => [...slots, ...created]);
                }
                if (failed.length === 0) {
                    const omitted = skipped === 1 ? 'Se omitió 1 que no se podía publicar.' : `Se omitieron ${skipped} que no se podían publicar.`;
                    this.toastService.success(created.length === 1 ? 'Espacio publicado' : `${created.length} espacios publicados`, skipped > 0 ? omitted : 'Ya están disponibles para agendar citas.');
                    this.resetSelection();
                    return;
                }
                // The published ones now show as overlaps, so a retry only sends the failed ones.
                const times = failed.map((result) => formatSlot(result.slot)).join(', ');
                const reason = failureReason(failed[0].error);
                this.errorMessage.set(`${failed.length === 1 ? 'No se pudo publicar 1 espacio' : `No se pudieron publicar ${failed.length} espacios`}: ${times}. ${reason}`);
                if (created.length > 0) {
                    this.toastService.success(created.length === 1 ? '1 espacio publicado' : `${created.length} espacios publicados`, failed.length === 1 ? '1 no se pudo publicar.' : `${failed.length} no se pudieron publicar.`);
                } else {
                    this.toastService.error('No se publicó ningún espacio', reason);
                }
                // A slot published meanwhile by someone else explains a conflict: read the calendar again so the preview shows it.
                this.loadedMonths.clear();
                this.loadMonth(true);
            });
    }

    /**
     * Asks for confirmation and removes a free slot.
     *
     * @param slot slot to remove
     */
    protected async confirmDeleteSlot(slot: AvailabilityResponse): Promise<void> {
        const confirmed = await this.dialogService.confirm({
            title: 'Eliminar espacio',
            message: `El espacio de ${formatTimes(slot.startDateTime, slot.endDateTime)} dejará de estar disponible para agendar citas.`,
            confirmLabel: 'Eliminar',
            destructive: true
        });
        if (confirmed) {
            this.deleteSlots([slot], `slot-${slot.id}`);
        }
    }

    /**
     * Asks for confirmation and removes every free slot of a day. Booked
     * appointments are kept: they have to be cancelled from the agenda.
     *
     * @param day day whose free slots are removed
     */
    protected async confirmDeleteDay(day: ConfiguredDay): Promise<void> {
        const count = day.freeSlots.length;
        const confirmed = await this.dialogService.confirm({
            title: 'Eliminar espacios del día',
            message: `Se eliminarán ${count === 1 ? 'el espacio libre' : `los ${count} espacios libres`} de este día. Las citas ya reservadas se conservan.`,
            confirmLabel: 'Eliminar',
            destructive: true
        });
        if (confirmed) {
            this.deleteSlots(day.freeSlots, `day-${day.key}`);
        }
    }

    protected isDeleting(key: string): boolean {
        return this.deletingKeys().has(key);
    }

    /**
     * Puts the changed slot in place of the old one.
     *
     * @param updated slot as saved by the backend
     */
    protected replaceSlot(updated: AvailabilityResponse): void {
        this.freeSlots.update((slots) => slots.map((item) => (item.id === updated.id ? updated : item)));
    }

    /** The slot may have been booked, or another one published, meanwhile: reads the calendar again. */
    protected reloadCalendar(): void {
        this.loadedMonths.clear();
        this.loadMonth(true);
    }

    /** Reads the calendar data of the visible month, unless it is already loaded. */
    protected loadMonth(force = false): void {
        const userId = this.availabilityForm.controls.userId.value;
        const { year, month } = this.visibleMonth();
        const key = `${userId}-${year}-${month}`;
        if (userId === null || (!force && this.loadedMonths.has(key))) {
            return;
        }
        const first = new Date(year, month - 1, 1);
        const last = new Date(year, month, 0, 23, 59, 59);
        this.monthRequest?.unsubscribe();
        this.isLoadingMonth.set(true);
        this.monthError.set(null);
        this.monthRequest = forkJoin({
            slots: this.appointmentService.findFreeAvailabilities(userId, toLocalDateTime(first), toLocalDateTime(last)),
            appointments: this.appointmentService.findAgenda(userId, toLocalDateTime(first), toLocalDateTime(last))
        })
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: ({ slots, appointments }) => {
                    this.loadedMonths.add(key);
                    // What was read replaces the month, so slots booked or removed meanwhile do not stay behind.
                    const inMonth = (item: { startDateTime: string }) => {
                        const start = new Date(item.startDateTime);
                        return start >= first && start <= last;
                    };
                    this.freeSlots.update((current) => [...current.filter((slot) => !inMonth(slot)), ...slots.filter((slot) => !slot.taken)]);
                    this.appointments.update((current) => [...current.filter((appointment) => !inMonth(appointment)), ...appointments]);
                    this.isLoadingMonth.set(false);
                },
                error: (error: unknown) => {
                    this.isLoadingMonth.set(false);
                    this.monthError.set(getApiErrorMessage(error, 'No se pudo cargar el calendario.'));
                }
            });
    }

    /**
     * Removes free slots one after another and reports the result.
     *
     * @param slots slots to remove
     * @param key   key of the button that shows the progress
     */
    private deleteSlots(slots: readonly AvailabilityResponse[], key: string): void {
        this.deletingKeys.update((keys) => new Set(keys).add(key));
        from(slots)
            .pipe(
                concatMap(
                    (slot): Observable<{ slot: AvailabilityResponse; error: unknown }> =>
                        this.appointmentService.deleteAvailability(slot.id).pipe(
                            map(() => ({ slot, error: null })),
                            catchError((error: unknown) => of({ slot, error }))
                        )
                ),
                toArray(),
                takeUntilDestroyed(this.destroyRef)
            )
            .subscribe((results) => {
                this.deletingKeys.update((keys) => {
                    const next = new Set(keys);
                    next.delete(key);
                    return next;
                });
                const removed = new Set(results.filter((result) => result.error === null).map((result) => result.slot.id));
                const failed = results.filter((result) => result.error !== null);
                this.freeSlots.update((current) => current.filter((slot) => !removed.has(slot.id)));
                if (failed.length === 0) {
                    this.toastService.success(removed.size === 1 ? 'Espacio eliminado' : `${removed.size} espacios eliminados`, 'Ya no están disponibles para agendar citas.');
                    return;
                }
                const partial = `${removed.size === 1 ? 'Se eliminó 1' : `Se eliminaron ${removed.size}`}; ${failed.length === 1 ? '1 no se pudo eliminar' : `${failed.length} no se pudieron eliminar`}`;
                this.toastService.error(removed.size > 0 ? partial : 'No se pudo eliminar', getApiErrorMessage(failed[0].error, 'Puede que ya tenga una cita agendada.'));
                // A slot that could not be removed may have been booked meanwhile: read the month again.
                this.loadMonth(true);
            });
    }

    /** Empties the picked days and puts back the default range after publishing. */
    private resetSelection(): void {
        this.ranges.clear({ emitEvent: false });
        this.ranges.push(this.buildRange(8, 12), { emitEvent: false });
        this.availabilityForm.patchValue({ dates: [], slotMinutes: null });
        this.availabilityForm.markAsPristine();
        this.availabilityForm.markAsUntouched();
        this.unsaved.markSaved();
    }

    /** Drops the data of the previous ergonomist and reads the visible month of the new one. */
    private resetCalendarData(): void {
        this.monthRequest?.unsubscribe();
        this.loadedMonths.clear();
        this.freeSlots.set([]);
        this.appointments.set([]);
        this.loadMonth();
    }

    /** Reads the active ergonomists and preselects the requested one. */
    private loadErgonomists(): void {
        this.isLoadingErgonomists.set(true);
        this.userService
            .findAll()
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (users) => {
                    const ergonomists = agendaOwnersOf(users, this.authService.session()?.userId);
                    this.ergonomists.set(ergonomists);
                    this.isLoadingErgonomists.set(false);
                    const preselected = ergonomists.find((ergonomist) => ergonomist.id === this.userId()) ?? ergonomists[0];
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

    /**
     * Builds the controls of a time range.
     *
     * @param start start hour, or a time picked before
     * @param end   end hour, or a time picked before
     */
    private buildRange(start: number | Date | null, end: number | Date | null): RangeGroup {
        const toTime = (value: number | Date | null) => (typeof value === 'number' ? timeOfDay(value) : value);
        return this.formBuilder.group(
            {
                startTime: this.formBuilder.control<Date | null>(toTime(start), [Validators.required]),
                endTime: this.formBuilder.control<Date | null>(toTime(end), [Validators.required])
            },
            { validators: validateRange }
        );
    }
}
