import { AbstractControl, ValidationErrors } from '@angular/forms';

import { AppointmentResponse, AvailabilityResponse } from '../../../shared/models/appointment.model';
import { getApiErrorMessage, isConflict } from '../../../shared/utils/api-error';
import { combineDayAndTime, dayKey, formatDuration, minutesBetween, rangesOverlap } from '../appointment-utils';

/** Shown for every HTTP 409, whatever the server sends, so a technical text never reaches the user. */
export const OVERLAP_MESSAGE = 'El horario seleccionado se cruza con una disponibilidad existente. Seleccione otro rango de fecha y hora.';

/** Why a planned slot cannot be published; null when it can. */
export type SlotProblem = 'past' | 'overlapsSlot' | 'overlapsAppointment' | 'repeated' | null;

/** Slot the form is about to publish, with the result of the overlap check. */
export interface PlannedSlot {
    key: string;
    start: Date;
    end: Date;
    problem: SlotProblem;
}

/** Planned slots of one day, ready to be drawn as a group. */
export interface PlannedDay {
    key: string;
    date: Date;
    slots: PlannedSlot[];
}

/** Entry of a day already configured: a free slot, or a booked appointment. */
export interface ConfiguredEntry {
    key: string;
    start: string;
    end: string;
    duration: string;
    slot?: AvailabilityResponse;
    appointment?: AppointmentResponse;
}

/** Configured entries of one day of the visible month. */
export interface ConfiguredDay {
    key: string;
    date: string;
    isPast: boolean;
    entries: ConfiguredEntry[];
    freeSlots: AvailabilityResponse[];
}

/** Published slot or booked appointment that a new slot cannot overlap. */
interface TakenInterval {
    start: Date;
    end: Date;
    kind: 'overlapsSlot' | 'overlapsAppointment';
}

/** Times of one range of the form; either side may still be empty. */
interface TimeRange {
    startTime: Date | null;
    endTime: Date | null;
}

export const PROBLEM_LABELS: Record<Exclude<SlotProblem, null>, string> = {
    past: 'Ya pasó',
    overlapsSlot: 'Se cruza con un espacio publicado',
    overlapsAppointment: 'Se cruza con una cita reservada',
    repeated: 'Se repite en esta selección'
};

/** Ready made ranges for the usual working hours. */
export const RANGE_PRESETS: readonly { label: string; ranges: readonly [number, number][] }[] = [
    { label: 'Mañana', ranges: [[8, 12]] },
    { label: 'Tarde', ranges: [[13, 17]] },
    {
        label: 'Jornada completa',
        ranges: [
            [8, 12],
            [13, 17]
        ]
    }
];

/** How each range can be cut: null publishes the whole range as one slot. */
export const SLOT_LENGTH_OPTIONS: { label: string; value: number | null }[] = [
    { label: 'Un solo espacio por rango', value: null },
    { label: 'Citas de 30 minutos', value: 30 },
    { label: 'Citas de 45 minutos', value: 45 },
    { label: 'Citas de 1 hora', value: 60 },
    { label: 'Citas de 1 h 30 min', value: 90 }
];

/** Status of an appointment whose slot became free again; every other status keeps it taken. */
const CANCELLED_STATUS = 'CANCELLED';

/**
 * Checks that a range ends after it starts.
 *
 * @param group group holding both times
 * @returns the error, or null when the range is valid
 */
export function validateRange(group: AbstractControl): ValidationErrors | null {
    const start = group.get('startTime')?.value as Date | null;
    const end = group.get('endTime')?.value as Date | null;
    if (!start || !end) {
        return null;
    }
    return end.getHours() * 60 + end.getMinutes() <= start.getHours() * 60 + start.getMinutes() ? { invalidRange: true } : null;
}

/** Requires at least one day picked in the calendar. */
export function requireDates(control: AbstractControl): ValidationErrors | null {
    return Array.isArray(control.value) && control.value.length > 0 ? null : { required: true };
}

/** Appointments that still hold their slot: every status but cancelled. */
export function bookedOf(appointments: readonly AppointmentResponse[]): AppointmentResponse[] {
    return appointments.filter((appointment) => appointment.status !== CANCELLED_STATUS);
}

/**
 * Indexes the published slots and booked appointments by the days they touch,
 * so each planned slot is only compared with the ones of its own day.
 */
export function takenByDay(freeSlots: readonly AvailabilityResponse[], booked: readonly AppointmentResponse[]): Map<string, TakenInterval[]> {
    const index = new Map<string, TakenInterval[]>();
    const add = (startText: string, endText: string, kind: TakenInterval['kind']) => {
        const start = new Date(startText);
        const end = new Date(endText);
        for (const key of new Set([dayKey(start), dayKey(end)])) {
            const intervals = index.get(key) ?? [];
            intervals.push({ start, end, kind });
            index.set(key, intervals);
        }
    };
    freeSlots.forEach((slot) => add(slot.startDateTime, slot.endDateTime, 'overlapsSlot'));
    booked.forEach((appointment) => add(appointment.startDateTime, appointment.endDateTime, 'overlapsAppointment'));
    return index;
}

/**
 * Slots the form would publish: every picked day times every range, cut in
 * appointments of the chosen length, each one checked against the slots
 * already published, the booked appointments and the rest of the selection.
 *
 * @param dates       picked days
 * @param ranges      time ranges of the form
 * @param slotMinutes length of each appointment, or null for one slot per range
 * @param taken       published slots and booked appointments, from takenByDay
 * @param now         current time in milliseconds; earlier slots are past
 */
export function planDays(dates: readonly Date[], ranges: readonly TimeRange[], slotMinutes: number | null, taken: Map<string, TakenInterval[]>, now: number): PlannedDay[] {
    return [...dates]
        .sort((a, b) => a.getTime() - b.getTime())
        .map((date) => {
            const key = dayKey(date);
            const takenToday = taken.get(key) ?? [];
            const accepted: { start: Date; end: Date }[] = [];
            const slots: PlannedSlot[] = [];
            for (const range of ranges) {
                const rangeStart = combineDayAndTime(date, range.startTime);
                const rangeEnd = combineDayAndTime(date, range.endTime);
                if (!rangeStart || !rangeEnd || rangeEnd <= rangeStart) {
                    continue;
                }
                for (const { start, end } of splitRange(rangeStart, rangeEnd, slotMinutes)) {
                    let problem: SlotProblem = null;
                    if (start.getTime() <= now) {
                        problem = 'past';
                    } else {
                        // A booked appointment explains the conflict better than its slot.
                        const clashes = takenToday.filter((other) => rangesOverlap(start, end, other.start, other.end));
                        if (clashes.length > 0) {
                            problem = clashes.some((other) => other.kind === 'overlapsAppointment') ? 'overlapsAppointment' : 'overlapsSlot';
                        } else if (accepted.some((other) => rangesOverlap(start, end, other.start, other.end))) {
                            problem = 'repeated';
                        } else {
                            accepted.push({ start, end });
                        }
                    }
                    slots.push({ key: `${start.getTime()}-${end.getTime()}`, start, end, problem });
                }
            }
            return { key, date, slots: slots.sort((a, b) => a.start.getTime() - b.start.getTime()) };
        });
}

/**
 * Days of a month that already have free slots or booked appointments, each
 * with its entries in time order.
 *
 * @param month month to show, from 1 to 12
 */
export function configuredDaysOf(freeSlots: readonly AvailabilityResponse[], booked: readonly AppointmentResponse[], year: number, month: number, today: Date): ConfiguredDay[] {
    const prefix = `${year}-${String(month).padStart(2, '0')}`;
    const todayKey = dayKey(today);
    const days = new Map<string, ConfiguredDay>();
    const dayOf = (start: string) => {
        const key = start.slice(0, 10);
        const day = days.get(key) ?? { key, date: start, isPast: key < todayKey, entries: [], freeSlots: [] };
        days.set(key, day);
        return day;
    };
    for (const slot of freeSlots) {
        if (slot.startDateTime.startsWith(prefix)) {
            const day = dayOf(slot.startDateTime);
            day.freeSlots.push(slot);
            day.entries.push({ key: `slot-${slot.id}`, start: slot.startDateTime, end: slot.endDateTime, duration: formatDuration(minutesBetween(slot.startDateTime, slot.endDateTime)), slot });
        }
    }
    for (const appointment of booked) {
        if (appointment.startDateTime.startsWith(prefix)) {
            dayOf(appointment.startDateTime).entries.push({
                key: `appointment-${appointment.id}`,
                start: appointment.startDateTime,
                end: appointment.endDateTime,
                duration: formatDuration(minutesBetween(appointment.startDateTime, appointment.endDateTime)),
                appointment
            });
        }
    }
    return [...days.values()].sort((a, b) => a.key.localeCompare(b.key)).map((day) => ({ ...day, entries: day.entries.sort((a, b) => a.start.localeCompare(b.start)) }));
}

/**
 * Cuts a range in consecutive appointments of the given length; without a
 * length the whole range is a single slot.
 */
export function splitRange(start: Date, end: Date, minutes: number | null): { start: Date; end: Date }[] {
    if (minutes === null) {
        return [{ start, end }];
    }
    const slots: { start: Date; end: Date }[] = [];
    const step = minutes * 60000;
    for (let time = start.getTime(); time + step <= end.getTime(); time += step) {
        slots.push({ start: new Date(time), end: new Date(time + step) });
    }
    return slots;
}

/** Minutes covered by a range, or null when it is incomplete or reversed. */
export function rangeMinutes(start: Date | null, end: Date | null): number | null {
    if (!start || !end) {
        return null;
    }
    const minutes = end.getHours() * 60 + end.getMinutes() - (start.getHours() * 60 + start.getMinutes());
    return minutes > 0 ? minutes : null;
}

/**
 * Explains why the backend rejected a slot. A conflict always gets the fixed
 * overlap message; any other error keeps the message of the backend.
 */
export function failureReason(error: unknown): string {
    return isConflict(error) ? OVERLAP_MESSAGE : getApiErrorMessage(error, 'Intente de nuevo.');
}

/** "lun 3 nov, 9:00 – 10:00", to name a slot in a message. */
export function formatSlot(slot: { start: Date; end: Date }): string {
    const day = slot.start.toLocaleDateString('es', { weekday: 'short', day: 'numeric', month: 'short' });
    const time = (date: Date) => date.toLocaleTimeString('es', { hour: 'numeric', minute: '2-digit' });
    return `${day}, ${time(slot.start)} – ${time(slot.end)}`;
}

/** Same as formatSlot, for the date-times of the backend. */
export function formatTimes(start: string, end: string): string {
    return formatSlot({ start: new Date(start), end: new Date(end) });
}

export function startOfToday(): Date {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
}
