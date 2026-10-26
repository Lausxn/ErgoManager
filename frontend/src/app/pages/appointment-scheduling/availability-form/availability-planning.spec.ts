import { AvailabilityResponse } from '../../../shared/models/appointment.model';
import { toLocalDateTime } from '../../../shared/utils/date-time';
import { timeOfDay } from '../appointment-utils';
import { planDays, rangeMinutes, splitRange, takenByDay } from './availability-planning';

/** A time of a fixed future day, so the checks do not depend on the clock. */
function at(hours: number, minutes = 0): Date {
    return new Date(2030, 4, 6, hours, minutes);
}

const DAY = new Date(2030, 4, 6);
const NOW = new Date(2030, 4, 6, 7).getTime();

function slotOf(id: number, start: Date, end: Date): AvailabilityResponse {
    return { id, userId: 1, fullName: 'Ergonomista', startDateTime: toLocalDateTime(start), endDateTime: toLocalDateTime(end), taken: false };
}

describe('availability-planning', () => {
    it('splitRange corta el rango en citas completas y descarta lo que sobra', () => {
        const slots = splitRange(at(8), at(10), 45);

        expect(slots.map((slot) => slot.start.getHours() * 60 + slot.start.getMinutes())).toEqual([480, 525]);
        expect(splitRange(at(8), at(10), null)).toEqual([{ start: at(8), end: at(10) }]);
    });

    it('rangeMinutes devuelve null para rangos incompletos o invertidos', () => {
        expect(rangeMinutes(timeOfDay(8), timeOfDay(9, 30))).toBe(90);
        expect(rangeMinutes(timeOfDay(9), timeOfDay(8))).toBeNull();
        expect(rangeMinutes(null, timeOfDay(8))).toBeNull();
    });

    it('planDays marca los espacios que ya pasaron, se cruzan o se repiten', () => {
        const taken = takenByDay([slotOf(1, at(10), at(11))], []);
        const ranges = [
            { startTime: timeOfDay(6), endTime: timeOfDay(7) },
            { startTime: timeOfDay(8), endTime: timeOfDay(9) },
            { startTime: timeOfDay(8, 30), endTime: timeOfDay(9, 30) },
            { startTime: timeOfDay(10), endTime: timeOfDay(11) }
        ];

        const [day] = planDays([DAY], ranges, null, taken, NOW);

        expect(day.slots.map((slot) => slot.problem)).toEqual(['past', null, 'repeated', 'overlapsSlot']);
    });
});
