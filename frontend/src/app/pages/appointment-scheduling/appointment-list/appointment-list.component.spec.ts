import { formatDate } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';

import { environment } from '../../../../environments/environment';
import { AuthService } from '../../../core/services/auth.service';
import { AppointmentResponse, AvailabilityResponse } from '../../../shared/models/appointment.model';
import { AppointmentStatus } from '../../../shared/models/appointment-status.model';
import { ToastService } from '../../../shared/services/toast.service';
import { toLocalDateTime } from '../../../shared/utils/date-time';
import { AppointmentListComponent } from './appointment-list.component';

const AGENDA_URL = `${environment.apiUrl}/appointments`;
const AVAILABILITIES_URL = `${environment.apiUrl}/appointments/availabilities`;
const ERGONOMIST_ID = 3;

/** A time some days from now. */
function at(days: number, hours: number): Date {
    const date = new Date();
    date.setDate(date.getDate() + days);
    date.setHours(hours, 0, 0, 0);
    return date;
}

function slotOf(id: number, start: Date): AvailabilityResponse {
    const end = new Date(start.getTime() + 60 * 60000);
    return { id, userId: ERGONOMIST_ID, fullName: 'Ergonomista', startDateTime: toLocalDateTime(start), endDateTime: toLocalDateTime(end), taken: false };
}

function appointmentOf(id: number, employeeName: string, start: Date, status: AppointmentStatus = 'SCHEDULED'): AppointmentResponse {
    const end = new Date(start.getTime() + 60 * 60000);
    return {
        id,
        selfEvaluationId: id,
        userId: ERGONOMIST_ID,
        employeeName,
        startDateTime: toLocalDateTime(start),
        endDateTime: toLocalDateTime(end),
        status,
        employeeEmail: `${id}@cliente.test`,
        companyId: 1,
        companyName: 'Cliente',
        ergonomistName: 'Ergonomista',
        evaluated: false
    };
}

describe('AppointmentListComponent: reprogramar cita', () => {
    let fixture: ComponentFixture<AppointmentListComponent>;
    let http: HttpTestingController;

    const pending = appointmentOf(40, 'Ana Mora', at(2, 9));
    const cancelled = appointmentOf(41, 'Luis Rojas', at(3, 9), 'CANCELLED');

    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [AppointmentListComponent],
            providers: [
                provideRouter([]),
                provideNoopAnimations(),
                provideHttpClient(),
                provideHttpClientTesting(),
                { provide: AuthService, useValue: { session: () => ({ userId: ERGONOMIST_ID, role: 'ERGONOMIST', fullName: 'Ergonomista' }) } },
                { provide: ToastService, useValue: jasmine.createSpyObj<ToastService>('ToastService', ['success', 'error', 'info']) }
            ]
        });
        http = TestBed.inject(HttpTestingController);
        fixture = TestBed.createComponent(AppointmentListComponent);
        fixture.detectChanges();
        // The agenda of the next 7 days and its free slots.
        http.expectOne((request) => request.method === 'GET' && request.url === AGENDA_URL).flush([pending, cancelled]);
        flushSlots([slotOf(1, at(3, 10))]);
    });

    afterEach(() => http.verify());

    function flushSlots(slots: AvailabilityResponse[]): void {
        http.expectOne((request) => request.method === 'GET' && request.url === AVAILABILITIES_URL).flush(slots);
        fixture.detectChanges();
    }

    function page(): HTMLElement {
        return fixture.nativeElement as HTMLElement;
    }

    function rowOf(employeeName: string): HTMLElement {
        const row = Array.from(page().querySelectorAll<HTMLElement>('tbody tr')).find((element) => element.textContent?.includes(employeeName));
        expect(row).withContext(`fila de ${employeeName}`).toBeDefined();
        return row!;
    }

    /** Opens the dialog from the row, picks the first slot and confirms. */
    async function rescheduleFromRow(employeeName: string, slots: AvailabilityResponse[]): Promise<void> {
        rowOf(employeeName).querySelector<HTMLElement>('button[aria-label="Reprogramar cita"]')!.click();
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();
        flushSlots(slots);
        document.querySelector<HTMLButtonElement>('.booking-dialog button.booking-slot')!.click();
        fixture.detectChanges();
        Array.from(document.querySelectorAll<HTMLButtonElement>('.booking-dialog button'))
            .find((button) => button.textContent?.trim() === 'Reprogramar')!
            .click();
        fixture.detectChanges();
    }

    it('ofrece "Reprogramar cita" solo en las citas pendientes', () => {
        expect(rowOf('Ana Mora').querySelector('button[aria-label="Reprogramar cita"]')).not.toBeNull();
        expect(rowOf('Luis Rojas').querySelector('button[aria-label="Reprogramar cita"]')).toBeNull();
    });

    it('al reprogramar, muestra el nuevo horario y vuelve a leer los espacios libres', async () => {
        const newSlot = slotOf(1, at(3, 10));
        await rescheduleFromRow('Ana Mora', [newSlot]);

        const request = http.expectOne({ method: 'PATCH', url: `${AGENDA_URL}/${pending.id}/reschedule` });
        expect(request.request.body).toEqual({ availabilityId: newSlot.id });
        request.flush({ ...pending, startDateTime: newSlot.startDateTime, endDateTime: newSlot.endDateTime });
        // The old slot is free again and the new one is taken.
        flushSlots([slotOf(7, at(2, 9))]);

        const time = formatDate(newSlot.startDateTime, 'shortTime', 'en-US');
        expect(rowOf('Ana Mora').textContent).toContain(time);
        expect(page().querySelector('.agenda-slots')!.textContent).toContain(formatDate(at(2, 9), 'shortTime', 'en-US'));
    });

    it('si la cita se mueve fuera del periodo, sale de la tabla', async () => {
        const farSlot = slotOf(2, at(20, 10));
        await rescheduleFromRow('Ana Mora', [farSlot]);

        http.expectOne({ method: 'PATCH', url: `${AGENDA_URL}/${pending.id}/reschedule` }).flush({ ...pending, startDateTime: farSlot.startDateTime, endDateTime: farSlot.endDateTime });
        flushSlots([]);

        expect(page().querySelector('tbody')!.textContent).not.toContain('Ana Mora');
    });
});
