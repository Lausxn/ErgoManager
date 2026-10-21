import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';

import { environment } from '../../../../environments/environment';
import { AuthService } from '../../../core/services/auth.service';
import { AvailabilityFormComponent } from './availability-form.component';

const URL = `${environment.apiUrl}/appointments/availabilities`;
const MESSAGE = 'El horario seleccionado se cruza con una disponibilidad existente. Seleccione otro rango de fecha y hora.';

describe('Availability overlap feedback', () => {
    let fixture: ComponentFixture<AvailabilityFormComponent>;
    let http: HttpTestingController;

    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [AvailabilityFormComponent],
            providers: [provideRouter([]), provideNoopAnimations(), provideHttpClient(), provideHttpClientTesting(), { provide: AuthService, useValue: { session: () => ({ userId: 62, role: 'ERGONOMIST', fullName: 'Ergonomista de prueba' }) } }]
        });
        http = TestBed.inject(HttpTestingController);
        fixture = TestBed.createComponent(AvailabilityFormComponent);
        fixture.detectChanges();
    });

    afterEach(() => http.verify());

    function publish(): void {
        const day = new Date();
        day.setDate(day.getDate() + 10);
        day.setHours(0, 0, 0, 0);
        const start = new Date(day);
        start.setHours(10);
        const end = new Date(day);
        end.setHours(11);
        fixture.componentInstance['availabilityForm'].patchValue({ date: day, startTime: start, endTime: end });
        fixture.detectChanges();
        (fixture.nativeElement as HTMLElement).querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    }

    for (const response of [{ message: MESSAGE }, {}, { message: 'SQL constraint exception' }]) {
        it(`shows useful conflict feedback and retains the entered range (${JSON.stringify(response)})`, () => {
            publish();
            http.expectOne(URL).flush(response, { status: 409, statusText: 'Conflict' });
            fixture.detectChanges();
            const element: HTMLElement = fixture.nativeElement;
            expect(element.querySelector('.mgs-alert[role="alert"]')?.textContent).toContain(MESSAGE);
            expect(element.textContent).not.toContain('SQL constraint exception');
            expect(fixture.componentInstance['availabilityForm'].controls.startTime.value?.getHours()).toBe(10);
            expect(fixture.componentInstance['isSubmitting']()).toBeFalse();
        });
    }

    it('allows retrying with a new range after a conflict', () => {
        publish();
        http.expectOne(URL).flush({}, { status: 409, statusText: 'Conflict' });
        const form = fixture.componentInstance['availabilityForm'];
        const start = new Date(form.controls.startTime.value!);
        start.setHours(11);
        const end = new Date(start);
        end.setHours(12);
        form.patchValue({ startTime: start, endTime: end });
        (fixture.nativeElement as HTMLElement).querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        const request = http.expectOne(URL);
        expect(request.request.body.startDateTime).toContain('T11:00:00');
        request.flush({}, { status: 400, statusText: 'Validation' });
    });
});
