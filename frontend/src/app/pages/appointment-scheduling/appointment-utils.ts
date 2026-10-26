import { formatDate } from '@angular/common';

import { AppointmentStatus } from '../../shared/models/appointment-status.model';
import { AvailabilityResponse } from '../../shared/models/appointment.model';
import { UserResponse } from '../../shared/models/user.model';

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

/**
 * Tells whether two time ranges share at least one minute. Ranges that only
 * touch, one ending when the other starts, do not overlap; this is the rule
 * the backend applies to the slots of an ergonomist.
 *
 * @param startA start of the first range
 * @param endA   end of the first range
 * @param startB start of the second range
 * @param endB   end of the second range
 * @returns true when they overlap
 */
export function rangesOverlap(startA: Date, endA: Date, startB: Date, endB: Date): boolean {
    return startA < endB && startB < endA;
}

/**
 * Key of a calendar day, the same for a Date and for a backend date-time.
 *
 * @param date date of the day
 * @returns yyyy-MM-dd
 */
export function dayKey(date: Date): string {
    const pad = (value: number) => String(value).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * Joins a calendar day and the hours and minutes of a time picked apart.
 *
 * @param day  date picked in the calendar
 * @param time date whose hours and minutes are used
 * @returns the combined date, or null when a part is missing
 */
export function combineDayAndTime(day: Date | null, time: Date | null): Date | null {
    if (!day || !time) {
        return null;
    }
    const result = new Date(day);
    result.setHours(time.getHours(), time.getMinutes(), 0, 0);
    return result;
}

/**
 * Builds a time of today, used as the value of the time-only pickers.
 *
 * @param hours   hour of the day, 0 to 23
 * @param minutes minutes of the hour
 * @returns the time as a date
 */
export function timeOfDay(hours: number, minutes = 0): Date {
    const time = new Date();
    time.setHours(hours, minutes, 0, 0);
    return time;
}

/** Owner of an agenda offered in the selector of the administrator. */
export interface ErgonomistOption {
    id: number;
    fullName: string;
    email: string;
    /** Text of the selector: the name, marked when it is the signed in user. */
    label: string;
}

/**
 * Builds the agendas an administrator can choose from: their own first, since
 * an administrator also attends appointments, then the active ergonomists by
 * name. Other administrators are left out.
 *
 * @param users         users returned by /api/users
 * @param currentUserId identifier of the signed in administrator
 * @returns options of the selector
 */
export function agendaOwnersOf(users: readonly UserResponse[], currentUserId: number | undefined): ErgonomistOption[] {
    const toOption = (user: UserResponse, own: boolean): ErgonomistOption => {
        const fullName = [user.firstName, user.firstLastName, user.secondLastName].filter(Boolean).join(' ');
        return { id: user.id, fullName, email: user.email, label: own ? `${fullName} (usted)` : fullName };
    };
    const own = users.filter((user) => user.active && user.id === currentUserId).map((user) => toOption(user, true));
    const ergonomists = users
        .filter((user) => user.active && user.role === 'ERGONOMIST' && user.id !== currentUserId)
        .map((user) => toOption(user, false))
        .sort((a, b) => a.fullName.localeCompare(b.fullName));
    return [...own, ...ergonomists];
}

/**
 * Writes a time range on a 12 hour clock, so morning and afternoon are never
 * confused: the period goes once when both times share it ("8:00 – 9:00 a. m.")
 * and after each time when the range crosses noon ("11:30 a. m. – 12:30 p. m.").
 *
 * @param start  beginning of the range
 * @param end    end of the range
 * @param locale locale of the texts, such as "es"
 * @returns the range as text
 */
export function formatTimeRange(start: Date | string, end: Date | string, locale: string): string {
    return timeRangeParts(start, end, locale).join(' – ');
}

/**
 * The two sides of {@link formatTimeRange}, so a narrow card can break the
 * range between them instead of inside a time.
 *
 * @param start  beginning of the range
 * @param end    end of the range
 * @param locale locale of the texts, such as "es"
 * @returns the beginning and the end, each with its period when needed
 */
export function timeRangeParts(start: Date | string, end: Date | string, locale: string): [string, string] {
    const time = (value: Date | string) => formatDate(value, 'h:mm', locale);
    const period = (value: Date | string) => formatDate(value, 'a', locale);
    return period(start) === period(end) ? [time(start), `${time(end)} ${period(end)}`] : [`${time(start)} ${period(start)}`, `${time(end)} ${period(end)}`];
}
