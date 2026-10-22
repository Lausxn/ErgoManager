import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';

import { environment } from '../../../../environments/environment';
import { AvailabilityResponse } from '../../../shared/models/appointment.model';
import { ToastService } from '../../../shared/services/toast.service';
import { toLocalDateTime } from '../../../shared/utils/date-time';
import { SlotEditDialogComponent } from './slot-edit-dialog.component';

const URL = `${environment.apiUrl}/appointments/availabilities/7`;
const OVERLAP = 'El horario seleccionado se cruza con una disponibilidad existente. Seleccione otro rango de fecha y hora.';

/** A time some days from today. */
function daysAhead(days: number, hours: number): Date {
    const date = new Date();
    date.setDate(date.getDate() + days);
    date.setHours(hours, 0, 0, 0);
    return date;
}

function slotOf(start: Date, end: Date, taken = false): AvailabilityResponse {
    return { id: 7, userId: 3, fullName: 'Laura Madrigal', startDateTime: toLocalDateTime(start), endDateTime: toLocalDateTime(end), taken };
}

describe('SlotEditDialogComponent', () => {
    let fixture: ComponentFixture<SlotEditDialogComponent>;
    let http: HttpTestingController;
    let toast: jasmine.SpyObj<ToastService>;

    beforeEach(() => {
        toast = jasmine.createSpyObj<ToastService>('ToastService', ['success', 'error', 'warning']);
        TestBed.configureTestingModule({
            imports: [SlotEditDialogComponent],
            providers: [provideNoopAnimations(), provideHttpClient(), provideHttpClientTesting(), { provide: ToastService, useValue: toast }]
        });
        http = TestBed.inject(HttpTestingController);
        fixture = TestBed.createComponent(SlotEditDialogComponent);
        fixture.componentRef.setInput('slot', slotOf(daysAhead(3, 8), daysAhead(3, 9)));
        // Drawn once while closed and then opened in state only: the specs check the
        // logic of the dialog, not its animation, which would outlive the test.
        fixture.detectChanges();
        fixture.componentInstance.visible.set(true);
    });

    /** Opens the dialog and answers the reading of the current state of the slot. */
    function open(current: AvailabilityResponse): void {
        fixture.componentInstance['onShow']();
        http.expectOne((request) => request.method === 'GET' && request.url === URL).flush(current);
    }

    function form() {
        return fixture.componentInstance['slotForm'];
    }

    afterEach(() => http.verify());

    it('carga el horario actual del espacio al abrir', () => {
        open(slotOf(daysAhead(3, 10), daysAhead(3, 12)));

        const { day, startTime, endTime } = form().getRawValue();
        expect(day?.getDate()).toBe(daysAhead(3, 0).getDate());
        expect(startTime?.getHours()).toBe(10);
        expect(endTime?.getHours()).toBe(12);
    });

    it('se cierra y pide recargar si el espacio ya fue reservado', () => {
        const outdated = jasmine.createSpy('outdated');
        fixture.componentInstance.outdated.subscribe(outdated);
        open(slotOf(daysAhead(3, 8), daysAhead(3, 9), true));

        expect(toast.warning).toHaveBeenCalledWith('El espacio ya fue reservado', jasmine.any(String));
        expect(outdated).toHaveBeenCalled();
        expect(fixture.componentInstance.visible()).toBeFalse();
    });

    it('guarda el nuevo horario con PUT y avisa a la página', () => {
        open(slotOf(daysAhead(3, 8), daysAhead(3, 9)));
        const saved = jasmine.createSpy('saved');
        fixture.componentInstance.saved.subscribe(saved);
        form().patchValue({ startTime: daysAhead(3, 14), endTime: daysAhead(3, 16) });

        fixture.componentInstance['submit']();
        const request = http.expectOne((call) => call.method === 'PUT' && call.url === URL);
        expect(request.request.body).toEqual({ userId: 3, startDateTime: toLocalDateTime(daysAhead(3, 14)), endDateTime: toLocalDateTime(daysAhead(3, 16)) });
        const updated = slotOf(daysAhead(3, 14), daysAhead(3, 16));
        request.flush(updated);

        expect(saved).toHaveBeenCalledWith(updated);
        expect(toast.success).toHaveBeenCalledWith('Horario actualizado', jasmine.any(String));
        expect(fixture.componentInstance.visible()).toBeFalse();
    });

    it('muestra el cruce que rechaza el backend y sigue abierto', () => {
        open(slotOf(daysAhead(3, 8), daysAhead(3, 9)));
        form().patchValue({ startTime: daysAhead(3, 9), endTime: daysAhead(3, 11) });

        fixture.componentInstance['submit']();
        http.expectOne((call) => call.method === 'PUT').flush({ message: OVERLAP }, { status: 409, statusText: 'Conflict' });

        expect(fixture.componentInstance['errorMessage']()).toBe(OVERLAP);
        expect(fixture.componentInstance.visible()).toBeTrue();
    });

    it('no envía horarios que terminan antes de empezar', () => {
        open(slotOf(daysAhead(3, 8), daysAhead(3, 9)));
        form().patchValue({ startTime: daysAhead(3, 12), endTime: daysAhead(3, 11) });

        fixture.componentInstance['submit']();

        expect(fixture.componentInstance['errorMessage']()).toBe('La hora final debe ser posterior a la inicial.');
    });
});
