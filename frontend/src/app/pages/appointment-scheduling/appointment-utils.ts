import { AppointmentStatus } from '../../shared/models/appointment-status.model';
import { AvailabilityResponse } from '../../shared/models/appointment.model';

export const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

/** Statuses of an appointment that still has to take place. */
const PENDING_STATUSES: readonly AppointmentStatus[] = ['SCHEDULED', 'CONFIRMED'];

/**
 * Tells whether an appointment still has to take place, so it can be
 * cancelled or evaluated.
 *
 * @param status status of the appointment
 * @returns true for scheduled and confirmed appointments
 */
export function isPendingStatus(status: AppointmentStatus): boolean {
    return PENDING_STATUSES.includes(status);
}

/**
 * Moves a date a number of days, keeping the time.
 *
 * @param date base date
 * @param days days to add, negative to go back
 * @returns a new date
 */
export function addDays(date: Date, days: number): Date {
    return new Date(date.getTime() + days * MILLISECONDS_PER_DAY);
}

/** Free slots of one day, ready to be drawn as a group. */
export interface SlotDay {
    key: string;
    date: string;
    slots: AvailabilityResponse[];
}

/**
 * Groups free slots by the day they start on, in chronological order.
 *
 * @param slots free slots in any order
 * @returns one group per day
 */
export function groupSlotsByDay(slots: readonly AvailabilityResponse[]): SlotDay[] {
    const days = new Map<string, SlotDay>();
    for (const slot of [...slots].sort((a, b) => a.startDateTime.localeCompare(b.startDateTime))) {
        const key = slot.startDateTime.slice(0, 10);
        const day = days.get(key) ?? { key, date: slot.startDateTime, slots: [] };
        day.slots.push(slot);
        days.set(key, day);
    }
    return [...days.values()];
}

/**
 * Describes a duration in minutes the way people say it: "1 h 30 min".
 *
 * @param minutes duration in minutes
 * @returns readable duration
 */
export function formatDuration(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    if (hours === 0) {
        return `${rest} min`;
    }
    return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

/**
 * Minutes between the start and the end of a slot returned by the backend.
 *
 * @param start start as yyyy-MM-ddTHH:mm:ss
 * @param end   end as yyyy-MM-ddTHH:mm:ss
 * @returns whole minutes
 */
export function minutesBetween(start: string, end: string): number {
    return Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000);
}
