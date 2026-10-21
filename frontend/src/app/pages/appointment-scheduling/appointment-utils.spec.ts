import { combineDayAndTime, dayKey, formatDuration, rangesOverlap, timeOfDay } from './appointment-utils';

describe('appointment-utils', () => {
    /** Builds a date of 22 October 2026 at the given time. */
    const at = (hours: number, minutes = 0) => new Date(2026, 9, 22, hours, minutes);

    describe('rangesOverlap', () => {
        it('detecta rangos que se cruzan', () => {
            expect(rangesOverlap(at(8), at(10), at(9), at(11))).toBeTrue();
        });

        it('detecta un rango contenido en otro', () => {
            expect(rangesOverlap(at(8), at(12), at(9), at(10))).toBeTrue();
        });

        it('permite rangos que solo se tocan, como hace el backend', () => {
            expect(rangesOverlap(at(8), at(9), at(9), at(10))).toBeFalse();
            expect(rangesOverlap(at(9), at(10), at(8), at(9))).toBeFalse();
        });

        it('permite rangos separados', () => {
            expect(rangesOverlap(at(8), at(9), at(13), at(14))).toBeFalse();
        });
    });

    describe('dayKey', () => {
        it('usa el formato de fecha del backend', () => {
            expect(dayKey(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05');
        });
    });

    describe('combineDayAndTime', () => {
        it('toma el día del calendario y la hora del selector', () => {
            const combined = combineDayAndTime(new Date(2026, 9, 22), timeOfDay(14, 45));
            expect(combined).toEqual(at(14, 45));
        });

        it('devuelve null si falta una parte', () => {
            expect(combineDayAndTime(null, timeOfDay(9))).toBeNull();
            expect(combineDayAndTime(new Date(2026, 9, 22), null)).toBeNull();
        });
    });

    describe('formatDuration', () => {
        it('describe la duración como se dice', () => {
            expect(formatDuration(45)).toBe('45 min');
            expect(formatDuration(60)).toBe('1 h');
            expect(formatDuration(90)).toBe('1 h 30 min');
        });
    });
});
