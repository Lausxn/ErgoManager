import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';

import { environment } from '../../../../environments/environment';
import { AppointmentResponse, AvailabilityResponse } from '../../../shared/models/appointment.model';
import { ToastService } from '../../../shared/services/toast.service';
import { toLocalDateTime } from '../../../shared/utils/date-time';
import { RescheduleDialogComponent } from './reschedule-dialog.component';

const SLOTS_URL = `${environment.apiUrl}/appointments/availabilities`;
const RESCHEDULE_URL = `${environment.apiUrl}/appointments/5/reschedule`;

/** A time some days from today. */
function daysAhead(days: number, hours: number): Date {
    const date = new Date();
    date.setDate(date.getDate() + days);
    date.setHours(hours, 0, 0, 0);
    return date;
}

function slotOf(id: number, start: Date, end: Date): AvailabilityResponse {
    return { id, userId: 3, fullName: 'Laura Madrigal', startDateTime: toLocalDateTime(start), endDateTime: toLocalDateTime(end), taken: false };
}

const APPOINTMENT: AppointmentResponse = {
    id: 5,
    selfEvaluationId: 9,
    userId: 3,
    employeeName: 'Carlos Rojas',
    startDateTime: toLocalDateTime(daysAhead(1, 9)),
    endDateTime: toLocalDateTime(daysAhead(1, 10)),
    status: 'SCHEDULED',
    employeeEmail: 'carlos@cliente.test',
    companyId: 1,
    companyName: 'Cliente',
    ergonomistName: 'Laura Madrigal',
    evaluated: false
};

describe('RescheduleDialogComponent', () => {
    let fixture: ComponentFixture<RescheduleDialogComponent>;
    let http: HttpTestingController;
    let toast: jasmine.SpyObj<ToastService>;

    beforeEach(() => {
        toast = jasmine.createSpyObj<ToastService>('ToastService', ['success', 'error']);
        TestBed.configureTestingModule({
            imports: [RescheduleDialogComponent],
            providers: [provideNoopAnimations(), provideHttpClient(), provideHttpClientTesting(), { provide: ToastService, useValue: toast }]
        });
        http = TestBed.inject(HttpTestingController);
        fixture = TestBed.createComponent(RescheduleDialogComponent);
        fixture.componentRef.setInput('appointment', APPOINTMENT);
        // Drawn once while closed and then opened in state only: the specs check the
        // logic of the dialog, not its animation, which would outlive the test.
        fixture.detectChanges();
        fixture.componentInstance.visible.set(true);
    });

    afterEach(() => http.verify());

    /** Opens the dialog and answers the reading of the free slots. */
    function open(slots: AvailabilityResponse[]): void {
        fixture.componentInstance['onShow']();
        const request = http.expectOne((call) => call.method === 'GET' && call.url === SLOTS_URL);
        expect(request.request.params.get('userId')).toBe('3');
        request.flush(slots);
    }

    it('ofrece solo los espacios libres del ergonomista de la cita', () => {
        open([slotOf(11, daysAhead(2, 8), daysAhead(2, 9)), slotOf(12, daysAhead(3, 8), daysAhead(3, 9))]);

        const days = fixture.componentInstance['slotDays']();
        expect(days.length).toBe(2);
        expect(days.flatMap((day) => day.slots).map((slot) => slot.id)).toEqual([11, 12]);
    });

    it('mueve la cita al espacio elegido con PATCH', () => {
        const rescheduled = jasmine.createSpy('rescheduled');
        fixture.componentInstance.rescheduled.subscribe(rescheduled);
        const target = slotOf(12, daysAhead(3, 8), daysAhead(3, 9));
        open([target]);

        fixture.componentInstance['selectSlot'](target);
        fixture.componentInstance['submit']();
        const request = http.expectOne((call) => call.method === 'PATCH' && call.url === RESCHEDULE_URL);
        expect(request.request.body).toEqual({ availabilityId: 12 });
        const updated = { ...APPOINTMENT, startDateTime: target.startDateTime, endDateTime: target.endDateTime };
        request.flush(updated);

        expect(rescheduled).toHaveBeenCalledWith(updated);
        expect(toast.success).toHaveBeenCalledWith('Cita reprogramada', jasmine.stringContaining('Carlos Rojas'));
        expect(fixture.componentInstance.visible()).toBeFalse();
    });

    it('muestra el error y vuelve a leer los espacios si el elegido ya se reservó', () => {
        const target = slotOf(12, daysAhead(3, 8), daysAhead(3, 9));
        open([target]);

        fixture.componentInstance['selectSlot'](target);
        fixture.componentInstance['submit']();
        http.expectOne(RESCHEDULE_URL).flush({ message: 'El espacio seleccionado ya fue reservado. Elija otro horario.' }, { status: 400, statusText: 'Bad Request' });
        http.expectOne((call) => call.method === 'GET' && call.url === SLOTS_URL).flush([]);

        expect(fixture.componentInstance['errorMessage']()).toBe('El espacio seleccionado ya fue reservado. Elija otro horario.');
        expect(fixture.componentInstance['availabilityId']()).toBeNull();
        expect(fixture.componentInstance.visible()).toBeTrue();
    });
});
