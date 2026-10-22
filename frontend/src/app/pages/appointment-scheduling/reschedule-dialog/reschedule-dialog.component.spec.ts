import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';

import { environment } from '../../../../environments/environment';
import { AppointmentResponse, AvailabilityResponse } from '../../../shared/models/appointment.model';
import { ToastService } from '../../../shared/services/toast.service';
import { toLocalDateTime } from '../../../shared/utils/date-time';
import { RescheduleDialogComponent } from './reschedule-dialog.component';

const AVAILABILITIES_URL = `${environment.apiUrl}/appointments/availabilities`;
const ERGONOMIST_ID = 3;

/** A time some days from now. */
function at(days: number, hours: number): Date {
    const date = new Date();
    date.setDate(date.getDate() + days);
    date.setHours(hours, 0, 0, 0);
    return date;
}

function slotOf(id: number, start: Date, taken = false): AvailabilityResponse {
    const end = new Date(start.getTime() + 60 * 60000);
    return { id, userId: ERGONOMIST_ID, fullName: 'Ergonomista', startDateTime: toLocalDateTime(start), endDateTime: toLocalDateTime(end), taken };
}

const APPOINTMENT: AppointmentResponse = {
    id: 40,
    selfEvaluationId: 9,
    userId: ERGONOMIST_ID,
    employeeName: 'Ana Mora',
    startDateTime: toLocalDateTime(at(2, 9)),
    endDateTime: toLocalDateTime(at(2, 10)),
    status: 'SCHEDULED',
    employeeEmail: 'ana@cliente.test',
    companyId: 1,
    companyName: 'Cliente',
    ergonomistName: 'Ergonomista',
    evaluated: false
};

describe('RescheduleDialogComponent', () => {
    let fixture: ComponentFixture<RescheduleDialogComponent>;
    let http: HttpTestingController;
    let toast: jasmine.SpyObj<ToastService>;
    let emitted: AppointmentResponse[];

    beforeEach(async () => {
        toast = jasmine.createSpyObj<ToastService>('ToastService', ['success', 'error', 'info']);
        TestBed.configureTestingModule({
            imports: [RescheduleDialogComponent],
            providers: [provideNoopAnimations(), provideHttpClient(), provideHttpClientTesting(), { provide: ToastService, useValue: toast }]
        });
        http = TestBed.inject(HttpTestingController);
        fixture = TestBed.createComponent(RescheduleDialogComponent);
        emitted = [];
        fixture.componentInstance.rescheduled.subscribe((appointment) => emitted.push(appointment));
        fixture.componentRef.setInput('appointment', APPOINTMENT);
        fixture.componentRef.setInput('visible', true);
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();
    });

    afterEach(() => http.verify());

    /** Answers the reading of free slots, checking it asks for the ergonomist of the appointment. */
    function flushSlots(slots: AvailabilityResponse[]): void {
        const request = http.expectOne((candidate) => candidate.method === 'GET' && candidate.url === AVAILABILITIES_URL);
        expect(request.request.params.get('userId')).toBe(String(ERGONOMIST_ID));
        request.flush(slots);
        fixture.detectChanges();
    }

    /** The dialog lives in the document, not inside the host element. */
    function dialog(): HTMLElement {
        return document.querySelector('.booking-dialog') as HTMLElement;
    }

    function slotButtons(): HTMLButtonElement[] {
        return Array.from(dialog().querySelectorAll<HTMLButtonElement>('button.booking-slot'));
    }

    function buttonByText(text: string): HTMLButtonElement {
        const button = Array.from(dialog().querySelectorAll('button')).find((element) => element.textContent?.trim() === text);
        expect(button).withContext(`botón "${text}"`).toBeDefined();
        return button!;
    }

    it('muestra la cita actual y los espacios libres del mismo ergonomista', () => {
        flushSlots([slotOf(1, at(3, 10)), slotOf(2, at(3, 11), true)]);

        expect(dialog().textContent).toContain('Cita actual de Ana Mora');
        // A taken slot is never offered.
        expect(slotButtons().length).toBe(1);
        expect(buttonByText('Reprogramar').disabled).toBeTrue();
    });

    it('envía PATCH /appointments/{id}/reschedule con el espacio elegido y avisa a la agenda', () => {
        flushSlots([slotOf(1, at(3, 10))]);
        slotButtons()[0].click();
        fixture.detectChanges();
        buttonByText('Reprogramar').click();

        const request = http.expectOne({ method: 'PATCH', url: `${environment.apiUrl}/appointments/${APPOINTMENT.id}/reschedule` });
        expect(request.request.body).toEqual({ availabilityId: 1 });
        const moved = { ...APPOINTMENT, startDateTime: toLocalDateTime(at(3, 10)), endDateTime: toLocalDateTime(at(3, 11)) };
        request.flush(moved);
        fixture.detectChanges();

        expect(emitted).toEqual([moved]);
        expect(toast.success).toHaveBeenCalledWith('Cita reprogramada', 'Ana Mora');
        expect(fixture.componentInstance.visible()).toBeFalse();
    });

    it('si el espacio ya fue reservado, muestra el mensaje y vuelve a leer los espacios', () => {
        flushSlots([slotOf(1, at(3, 10)), slotOf(2, at(3, 12))]);
        slotButtons()[0].click();
        fixture.detectChanges();
        buttonByText('Reprogramar').click();

        http.expectOne({ method: 'PATCH', url: `${environment.apiUrl}/appointments/${APPOINTMENT.id}/reschedule` }).flush(
            { status: 400, message: 'El espacio seleccionado ya fue reservado. Elija otro horario.' },
            { status: 400, statusText: 'Bad Request' }
        );
        flushSlots([slotOf(2, at(3, 12))]);

        expect(dialog().querySelector('.mgs-alert[role="alert"]')?.textContent).toContain('El espacio seleccionado ya fue reservado. Elija otro horario.');
        expect(slotButtons().length).toBe(1);
        expect(buttonByText('Reprogramar').disabled).toBeTrue();
        expect(emitted).toEqual([]);
    });
});
