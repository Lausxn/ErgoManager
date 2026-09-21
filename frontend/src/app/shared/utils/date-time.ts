/**
 * Formats a date as the LocalDateTime the backend expects in a body
 * (yyyy-MM-ddTHH:mm:ss), keeping the local time instead of converting to UTC.
 *
 * @param date date picked by the user
 * @returns the date as a local ISO string without zone
 */
export function toLocalDateTime(date: Date): string {
    const pad = (value: number) => String(value).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:00`;
}
