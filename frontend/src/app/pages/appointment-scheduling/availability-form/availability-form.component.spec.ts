import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';

import { environment } from '../../../../environments/environment';
import { AuthService } from '../../../core/services/auth.service';
import { AppointmentResponse, AvailabilityResponse } from '../../../shared/models/appointment.model';
import { AppointmentStatus } from '../../../shared/models/appointment-status.model';
import { DialogService } from '../../../shared/services/dialog.service';
import { ToastService } from '../../../shared/services/toast.service';
import { toLocalDateTime } from '../../../shared/utils/date-time';
import { timeOfDay } from '../appointment-utils';
import { AvailabilityFormComponent } from './availability-form.component';

const URL = `${environment.apiUrl}/appointments/availabilities`;
const AGENDA_URL = `${environment.apiUrl}/appointments`;
const MESSAGE = 'El horario seleccionado se cruza con una disponibilidad existente. Seleccione otro rango de fecha y hora.';
const USER_ID = 62;

/** Day after today, at midnight. */
function daysFromToday(days: number): Date {
    const day = new Date();
    day.setDate(day.getDate() + days);
    day.setHours(0, 0, 0, 0);
    return day;
}

/** A time of the given day. */
function at(day: Date, hours: number, minutes = 0): Date {
    const date = new Date(day);
    date.setHours(hours, minutes, 0, 0);
    return date;
}

function slotOf(id: number, start: Date, end: Date): AvailabilityResponse {
    return { id, userId: USER_ID, fullName: 'Ergonomista de prueba', startDateTime: toLocalDateTime(start), endDateTime: toLocalDateTime(end), taken: false };
}

function appointmentOf(id: number, start: Date, end: Date, status: AppointmentStatus = 'SCHEDULED'): AppointmentResponse {
    return {
        id,
        selfEvaluationId: id,
        userId: USER_ID,
        employeeName: 'Ana Mora',
        startDateTime: toLocalDateTime(start),
        endDateTime: toLocalDateTime(end),
        status,
        employeeEmail: 'ana@cliente.test',
        companyId: 1,
        companyName: 'Cliente',
        ergonomistName: 'Ergonomista de prueba',
        evaluated: false
    };
}

describe('AvailabilityFormComponent', () => {
    let fixture: ComponentFixture<AvailabilityFormComponent>;
    let http: HttpTestingController;
    let toast: jasmine.SpyObj<ToastService>;
    let dialog: jasmine.SpyObj<DialogService>;

    /**
     * Opens the page as an ergonomist and answers the reading of the visible
     * month with the given slots and appointments.
     */
    function setup(slots: AvailabilityResponse[] = [], appointments: AppointmentResponse[] = []): void {
        toast = jasmine.createSpyObj<ToastService>('ToastService', ['success', 'error', 'info']);
        dialog = jasmine.createSpyObj<DialogService>('DialogService', ['confirm']);
        TestBed.configureTestingModule({
            imports: [AvailabilityFormComponent],
            providers: [
                provideRouter([]),
                provideNoopAnimations(),
                provideHttpClient(),
                provideHttpClientTesting(),
                { provide: AuthService, useValue: { session: () => ({ userId: USER_ID, role: 'ERGONOMIST', fullName: 'Ergonomista de prueba' }) } },
                { provide: ToastService, useValue: toast },
                { provide: DialogService, useValue: dialog }
            ]
        });
        http = TestBed.inject(HttpTestingController);
        fixture = TestBed.createComponent(AvailabilityFormComponent);
        fixture.detectChanges();
        flushMonth(slots, appointments);
    }

    /** Answers the two requests that read a month: free slots and agenda. */
    function flushMonth(slots: AvailabilityResponse[] = [], appointments: AppointmentResponse[] = []): void {
        const slotsRequest = http.expectOne((request) => request.method === 'GET' && request.url === URL);
        expect(slotsRequest.request.params.get('userId')).toBe(String(USER_ID));
        slotsRequest.flush(slots);
        http.expectOne((request) => request.method === 'GET' && request.url === AGENDA_URL).flush(appointments);
        fixture.detectChanges();
    }

    function form() {
        return fixture.componentInstance['availabilityForm'];
    }

    /** Picks the days, the ranges ([start, end] as hours or times) and the length of each appointment. */
    function plan(days: Date[], ranges: [number | Date, number | Date][], slotMinutes: number | null = null): void {
        form().controls.ranges.clear();
        ranges.forEach(([start, end]) => form().controls.ranges.push(fixture.componentInstance['buildRange'](start, end)));
        form().controls.slotMinutes.setValue(slotMinutes);
        form().controls.dates.setValue(days);
        fixture.detectChanges();
    }

    function submit(): void {
        (fixture.nativeElement as HTMLElement).querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        fixture.detectChanges();
    }

    function page(): HTMLElement {
        return fixture.nativeElement as HTMLElement;
    }

    /** Texts under each slot of the preview: "Se publicará" or the reason it is blocked. */
    function previewDetails(): string[] {
        return Array.from(page().querySelectorAll('section[aria-labelledby="availability-preview-title"] .availability-slot__detail')).map((detail) => detail.textContent!.trim());
    }

    function buttonByText(text: string): HTMLButtonElement {
        const button = Array.from(page().querySelectorAll('button')).find((element) => element.textContent?.trim() === text);
        expect(button).withContext(`botón "${text}"`).toBeDefined();
        return button!;
    }

    afterEach(() => http.verify());

    describe('mensaje de cruce (Task 62)', () => {
        for (const response of [{ message: MESSAGE }, {}, { message: 'SQL constraint exception' }]) {
            it(`muestra el mensaje fijo y conserva el horario elegido (${JSON.stringify(response)})`, () => {
                setup();
                plan([daysFromToday(10)], [[10, 11]]);
                submit();

                http.expectOne((request) => request.method === 'POST' && request.url === URL).flush(response, { status: 409, statusText: 'Conflict' });
                flushMonth();

                expect(page().querySelector('.mgs-alert[role="alert"]')?.textContent).toContain(MESSAGE);
                expect(page().textContent).not.toContain('SQL constraint exception');
                expect(toast.error).toHaveBeenCalledWith('No se publicó ningún espacio', MESSAGE);
                expect(form().controls.dates.value.length).toBe(1);
                expect(form().controls.ranges.at(0).controls.startTime.value?.getHours()).toBe(10);
                expect(fixture.componentInstance['isSubmitting']()).toBeFalse();
            });
        }

        it('permite reintentar con otro horario después de un cruce', () => {
            setup();
            plan([daysFromToday(10)], [[10, 11]]);
            submit();
            http.expectOne((request) => request.method === 'POST' && request.url === URL).flush({}, { status: 409, statusText: 'Conflict' });
            flushMonth();

            form()
                .controls.ranges.at(0)
                .setValue({ startTime: timeOfDay(11), endTime: timeOfDay(12) });
            submit();

            const request = http.expectOne((candidate) => candidate.method === 'POST' && candidate.url === URL);
            expect(request.request.body.startDateTime).toContain('T11:00:00');
            expect(request.request.body.userId).toBe(USER_ID);
            request.flush({ message: 'La hora de fin debe ser posterior a la de inicio.' }, { status: 400, statusText: 'Bad Request' });
            flushMonth();

            // Any other error keeps the message of the backend.
            expect(page().querySelector('.mgs-alert[role="alert"]')?.textContent).toContain('La hora de fin debe ser posterior a la de inicio.');
        });
    });

    describe('vista previa', () => {
        it('marca los espacios que se cruzan con un espacio publicado, una cita reservada o la propia selección', () => {
            const day = daysFromToday(10);
            setup([slotOf(1, at(day, 10), at(day, 11))], [appointmentOf(5, at(day, 14), at(day, 15)), appointmentOf(6, at(day, 16), at(day, 17), 'CANCELLED')]);

            plan(
                [day],
                [
                    [9, 12],
                    [timeOfDay(14, 30), timeOfDay(15, 30)],
                    [16, 17],
                    [9, 10]
                ],
                60
            );

            const details = previewDetails();
            expect(details.filter((detail) => detail === 'Se publicará').length)
                .withContext(details.join(' | '))
                .toBe(3);
            expect(details).toContain('Se cruza con un espacio publicado');
            expect(details).toContain('Se cruza con una cita reservada');
            expect(details).toContain('Se repite en esta selección');
            expect(page().textContent).toContain('3 espacios se publicarán. 3 no se pueden habilitar porque ya pasaron o se cruzan con otro horario.');
        });

        it('un espacio puede empezar justo cuando termina otro', () => {
            const day = daysFromToday(10);
            setup([slotOf(1, at(day, 10), at(day, 11))]);

            plan([day], [[11, 12]]);

            expect(previewDetails()).toEqual(['Se publicará']);
            expect(page().textContent).toContain('1 espacio se publicará.');
        });

        it('no publica los horarios que ya pasaron', () => {
            setup();
            plan([daysFromToday(0)], [[0, 1]]);

            expect(previewDetails()).toEqual(['Ya pasó']);
            expect(page().textContent).toContain('0 espacios se publicarán. 1 no se puede habilitar porque ya pasó o se cruza con otro horario.');

            submit();
            expect(page().querySelector('.mgs-alert[role="alert"]')?.textContent).toContain('Ninguno de los espacios se puede publicar');
        });

        for (const [minutes, count, leftover] of [
            [30, 8, false],
            [45, 5, true],
            [60, 4, false],
            [90, 2, true]
        ] as const) {
            it(`divide un rango de 8:00 a 12:00 en citas de ${minutes} minutos`, () => {
                setup();
                plan([daysFromToday(10)], [[8, 12]], minutes);

                expect(previewDetails().length).toBe(count);
                expect(page().textContent!.includes('los minutos que sobran al final no se publican')).toBe(leftover);
            });
        }
    });

    describe('publicar', () => {
        it('envía cada espacio y, si alguno falla, informa cuál y vuelve a leer el calendario', () => {
            const day = daysFromToday(10);
            setup();
            plan([day], [[10, 12]], 60);
            submit();

            const first = http.expectOne((request) => request.method === 'POST' && request.url === URL);
            expect(first.request.body).toEqual({ userId: USER_ID, startDateTime: toLocalDateTime(at(day, 10)), endDateTime: toLocalDateTime(at(day, 11)) });
            first.flush(slotOf(10, at(day, 10), at(day, 11)));
            const second = http.expectOne((request) => request.method === 'POST' && request.url === URL);
            expect(second.request.body.startDateTime).toBe(toLocalDateTime(at(day, 11)));
            second.flush({ message: 'SQL constraint exception' }, { status: 409, statusText: 'Conflict' });
            // Someone else published 11:00-12:00 meanwhile.
            flushMonth([slotOf(10, at(day, 10), at(day, 11)), slotOf(11, at(day, 11), at(day, 12))]);

            expect(toast.success).toHaveBeenCalledWith('1 espacio publicado', '1 no se pudo publicar.');
            const alert = page().querySelector('.mgs-alert[role="alert"]')!.textContent!;
            expect(alert).toContain('No se pudo publicar 1 espacio');
            expect(alert).toContain(MESSAGE);
            // A retry would send nothing: both slots now show as published.
            expect(previewDetails()).toEqual(['Se cruza con un espacio publicado', 'Se cruza con un espacio publicado']);
            expect(fixture.componentInstance['publishLabel']()).toBe('Publicar');
        });

        it('publica todo y limpia la selección', () => {
            const day = daysFromToday(10);
            setup();
            plan([day], [[10, 12]], 60);
            submit();

            http.expectOne((request) => request.method === 'POST' && request.url === URL).flush(slotOf(10, at(day, 10), at(day, 11)));
            http.expectOne((request) => request.method === 'POST' && request.url === URL).flush(slotOf(11, at(day, 11), at(day, 12)));
            fixture.detectChanges();

            expect(toast.success).toHaveBeenCalledWith('2 espacios publicados', 'Ya están disponibles para agendar citas.');
            expect(form().controls.dates.value).toEqual([]);
        });
    });

    describe('eliminar', () => {
        /** Day of the visible month, where the configured list shows its slots. */
        function dayOfThisMonth(): Date {
            const day = new Date();
            day.setDate(15);
            day.setHours(0, 0, 0, 0);
            return day;
        }

        it('elimina los espacios libres de un día después de confirmar y conserva la cita reservada', async () => {
            const day = dayOfThisMonth();
            setup([slotOf(1, at(day, 8), at(day, 9)), slotOf(2, at(day, 9), at(day, 10))], [appointmentOf(5, at(day, 10), at(day, 11))]);
            dialog.confirm.and.resolveTo(true);

            // The booked appointment has no delete button.
            expect(page().querySelectorAll('button[aria-label="Eliminar espacio"]').length).toBe(2);
            buttonByText('Eliminar los 2 espacios libres').click();
            await fixture.whenStable();

            expect(dialog.confirm).toHaveBeenCalledWith(jasmine.objectContaining({ message: jasmine.stringContaining('los 2 espacios libres') }));
            http.expectOne((request) => request.method === 'DELETE' && request.url === `${URL}/1`).flush(null, { status: 204, statusText: 'No Content' });
            http.expectOne((request) => request.method === 'DELETE' && request.url === `${URL}/2`).flush(null, { status: 204, statusText: 'No Content' });
            fixture.detectChanges();

            expect(toast.success).toHaveBeenCalledWith('2 espacios eliminados', 'Ya no están disponibles para agendar citas.');
            expect(page().querySelectorAll('button[aria-label="Eliminar espacio"]').length).toBe(0);
            expect(page().textContent).toContain('Ana Mora');
        });

        it('no elimina nada si se cancela la confirmación', async () => {
            const day = dayOfThisMonth();
            setup([slotOf(1, at(day, 8), at(day, 9))]);
            dialog.confirm.and.resolveTo(false);

            page().querySelector<HTMLButtonElement>('button[aria-label="Eliminar espacio"]')!.click();
            await fixture.whenStable();

            http.expectNone((request) => request.method === 'DELETE');
            expect(page().querySelectorAll('button[aria-label="Eliminar espacio"]').length).toBe(1);
        });

        it('si el espacio ya fue reservado, lo informa y muestra la cita en su lugar', async () => {
            const day = dayOfThisMonth();
            setup([slotOf(1, at(day, 8), at(day, 9))]);
            dialog.confirm.and.resolveTo(true);

            page().querySelector<HTMLButtonElement>('button[aria-label="Eliminar espacio"]')!.click();
            await fixture.whenStable();
            http.expectOne((request) => request.method === 'DELETE' && request.url === `${URL}/1`).flush({ message: 'No se puede eliminar un espacio que ya tiene una cita.' }, { status: 400, statusText: 'Bad Request' });
            flushMonth([], [appointmentOf(5, at(day, 8), at(day, 9))]);

            expect(toast.error).toHaveBeenCalledWith('No se pudo eliminar', 'No se puede eliminar un espacio que ya tiene una cita.');
            // The month read again replaces the old free slot with the appointment.
            expect(page().querySelectorAll('button[aria-label="Eliminar espacio"]').length).toBe(0);
            expect(page().textContent).toContain('Ana Mora');
        });
    });

    describe('editar espacio', () => {
        /** Tomorrow, shown in the configured list: when it falls in the next month, the calendar moves there. */
        function setupTomorrow(slots: (day: Date) => AvailabilityResponse[], appointments: (day: Date) => AppointmentResponse[] = () => []): Date {
            const day = daysFromToday(1);
            const sameMonth = day.getMonth() === new Date().getMonth();
            setup(sameMonth ? slots(day) : [], sameMonth ? appointments(day) : []);
            if (!sameMonth) {
                fixture.componentInstance['changeMonth']({ month: day.getMonth() + 1, year: day.getFullYear() });
                flushMonth(slots(day), appointments(day));
            }
            return day;
        }

        function editButtons(): HTMLButtonElement[] {
            return Array.from(page().querySelectorAll<HTMLButtonElement>('button[aria-label="Editar espacio"]'));
        }

        function editForm() {
            return fixture.componentInstance['editForm'];
        }

        /** Opens the dialog of the first free slot. */
        async function openFirst(): Promise<void> {
            editButtons()[0].click();
            fixture.detectChanges();
            await fixture.whenStable();
            fixture.detectChanges();
        }

        function save(): void {
            Array.from(document.querySelectorAll<HTMLButtonElement>('.availability-edit-dialog button'))
                .find((button) => button.textContent?.trim() === 'Guardar cambios')!
                .click();
            fixture.detectChanges();
        }

        function dialogAlert(): string {
            return document.querySelector('.availability-edit-dialog .mgs-alert[role="alert"]')?.textContent?.trim() ?? '';
        }

        it('se ofrece en los espacios libres futuros y no en las citas reservadas', () => {
            setupTomorrow(
                (day) => [slotOf(1, at(day, 8), at(day, 9)), slotOf(2, at(daysFromToday(-1), 8), at(daysFromToday(-1), 9))],
                (day) => [appointmentOf(5, at(day, 10), at(day, 11))]
            );

            // Yesterday's slot, if it is in the list at all, belongs to a past day.
            expect(editButtons().length).toBe(1);
        });

        it('carga el espacio, envía PUT /availabilities/{id} con las horas nuevas y actualiza la lista', async () => {
            const day = setupTomorrow((tomorrow) => [slotOf(1, at(tomorrow, 8), at(tomorrow, 9))]);
            await openFirst();

            expect(editForm().controls.date.value?.getDate()).toBe(day.getDate());
            expect(editForm().controls.startTime.value?.getHours()).toBe(8);
            expect(editForm().controls.endTime.value?.getHours()).toBe(9);

            editForm().controls.startTime.setValue(timeOfDay(14));
            editForm().controls.endTime.setValue(timeOfDay(15, 30));
            save();

            const request = http.expectOne((candidate) => candidate.method === 'PUT' && candidate.url === `${URL}/1`);
            expect(request.request.body).toEqual({ userId: USER_ID, startDateTime: toLocalDateTime(at(day, 14)), endDateTime: toLocalDateTime(at(day, 15, 30)) });
            request.flush(slotOf(1, at(day, 14), at(day, 15, 30)));
            fixture.detectChanges();

            expect(toast.success).toHaveBeenCalledWith('Espacio actualizado', jasmine.any(String));
            expect(fixture.componentInstance['isEditOpen']()).toBeFalse();
            expect(page().textContent).toContain('Libre · 1 h 30 min');
        });

        it('no envía un horario que se cruza con otro espacio o que termina antes de empezar', async () => {
            setupTomorrow((day) => [slotOf(1, at(day, 8), at(day, 9)), slotOf(2, at(day, 10), at(day, 11))]);
            await openFirst();

            editForm().controls.endTime.setValue(timeOfDay(10, 30));
            save();
            expect(dialogAlert()).toContain(MESSAGE);

            editForm().controls.endTime.setValue(timeOfDay(7));
            save();
            expect(document.querySelector('.availability-edit-dialog')!.textContent).toContain('La hora final debe ser posterior a la inicial.');

            http.expectNone((request) => request.method === 'PUT');
        });

        it('ante un 409 muestra el mensaje fijo de cruce y vuelve a leer el calendario', async () => {
            const day = setupTomorrow((tomorrow) => [slotOf(1, at(tomorrow, 8), at(tomorrow, 9))]);
            await openFirst();
            editForm().controls.endTime.setValue(timeOfDay(10));
            save();

            http.expectOne((request) => request.method === 'PUT' && request.url === `${URL}/1`).flush({ message: 'SQL constraint exception' }, { status: 409, statusText: 'Conflict' });
            flushMonth([slotOf(1, at(day, 8), at(day, 9)), slotOf(3, at(day, 9), at(day, 10))]);

            expect(dialogAlert()).toContain(MESSAGE);
            expect(document.body.textContent).not.toContain('SQL constraint exception');
            expect(fixture.componentInstance['isEditOpen']()).toBeTrue();
        });

        it('si el espacio ya tiene una cita, muestra el mensaje del backend y la cita en la lista', async () => {
            const day = setupTomorrow((tomorrow) => [slotOf(1, at(tomorrow, 8), at(tomorrow, 9))]);
            await openFirst();
            editForm().controls.endTime.setValue(timeOfDay(10));
            save();

            http.expectOne((request) => request.method === 'PUT' && request.url === `${URL}/1`).flush({ message: 'No se puede editar un espacio que ya tiene una cita.' }, { status: 400, statusText: 'Bad Request' });
            flushMonth([], [appointmentOf(5, at(day, 8), at(day, 9))]);

            expect(dialogAlert()).toContain('No se puede editar un espacio que ya tiene una cita.');
            expect(editButtons().length).toBe(0);
            expect(page().textContent).toContain('Ana Mora');
        });
    });
});
