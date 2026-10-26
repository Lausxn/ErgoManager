import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { environment } from '../../../environments/environment';
import { AppointmentResponse } from '../../shared/models/appointment.model';
import { AppointmentStatus } from '../../shared/models/appointment-status.model';
import { LoginResponse } from '../../shared/models/auth.model';
import { Role } from '../../shared/models/role.model';
import { toLocalDateTime } from '../../shared/utils/date-time';
import { DashboardComponent } from './dashboard.component';

const SESSION_STORAGE_KEY = 'ergomanager.session';
const SUMMARY_URL = `${environment.apiUrl}/dashboard/summary`;
const AGENDA_URL = `${environment.apiUrl}/appointments`;
const ALL_AGENDAS_URL = `${environment.apiUrl}/appointments/all`;

const ME = 1;
const OTHER = 2;

function sessionOf(role: Role): LoginResponse {
    return { token: 'token', tokenType: 'Bearer', expiresAtMs: Number.MAX_SAFE_INTEGER, userId: ME, fullName: 'Ana Prueba', role, mustChangePassword: false };
}

/** A time some minutes away from now. */
function minutesFromNow(minutes: number): Date {
    return new Date(Date.now() + minutes * 60_000);
}

/** A time of another day, at the given hour. */
function dayAt(days: number, hour: number): Date {
    const date = new Date();
    date.setDate(date.getDate() + days);
    date.setHours(hour, 0, 0, 0);
    return date;
}

function appointmentOf(id: number, employeeName: string, start: Date, options: { userId?: number; status?: AppointmentStatus; evaluated?: boolean; minutes?: number } = {}): AppointmentResponse {
    const userId = options.userId ?? ME;
    return {
        id,
        selfEvaluationId: id,
        userId,
        employeeName,
        startDateTime: toLocalDateTime(start),
        endDateTime: toLocalDateTime(new Date(start.getTime() + (options.minutes ?? 60) * 60_000)),
        status: options.status ?? 'SCHEDULED',
        employeeEmail: `${id}@cliente.test`,
        companyId: 1,
        companyName: 'Comercial Norte',
        ergonomistName: userId === ME ? 'Ana Prueba' : 'Keisy Rojas',
        evaluated: options.evaluated ?? false
    };
}

describe('DashboardComponent', () => {
    let fixture: ComponentFixture<DashboardComponent>;
    let element: HTMLElement;
    let http: HttpTestingController;
    let navigateSpy: jasmine.Spy;

    function open(role: Role): void {
        localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessionOf(role)));
        TestBed.configureTestingModule({
            imports: [DashboardComponent],
            providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()]
        });
        http = TestBed.inject(HttpTestingController);
        navigateSpy = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
        fixture = TestBed.createComponent(DashboardComponent);
        fixture.detectChanges();
        element = fixture.nativeElement;
    }

    /** Answers the reading of appointments that the role makes. */
    function flushAppointments(role: Role, appointments: AppointmentResponse[]): TestRequest {
        const request = http.expectOne((candidate) => candidate.method === 'GET' && candidate.url === (role === 'ADMIN' ? ALL_AGENDAS_URL : AGENDA_URL));
        request.flush(appointments);
        fixture.detectChanges();
        return request;
    }

    function openAdmin(appointments: AppointmentResponse[]): void {
        open('ADMIN');
        http.expectOne(SUMMARY_URL).flush({ scheduledAppointments: 3, activeCompanies: 2, activeUsers: 4, activeForms: 1 });
        flushAppointments('ADMIN', appointments);
    }

    function text(selector: string): string {
        return element.querySelector(selector)?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
    }

    function texts(selector: string): string[] {
        return Array.from(element.querySelectorAll(selector)).map((node) => node.textContent?.replace(/\s+/g, ' ').trim() ?? '');
    }

    // A fixed 10:00 keeps "in progress" and "later today" inside the same day whenever the tests run.
    beforeEach(() => {
        jasmine.clock().install();
        jasmine.clock().mockDate(dayAt(0, 10));
    });

    afterEach(() => {
        http.verify();
        localStorage.removeItem(SESSION_STORAGE_KEY);
        jasmine.clock().uninstall();
    });

    it('saluda con el primer nombre del usuario de la sesión', () => {
        openAdmin([]);
        expect(text('.dashboard__greeting')).toMatch(/^Buen(os|as) (días|tardes|noches), Ana$/);
    });

    describe('lo que lee cada rol', () => {
        it('el administrador lee las citas de todas las agendas y las cifras del sistema', () => {
            open('ADMIN');
            http.expectOne(SUMMARY_URL).flush({ scheduledAppointments: 3, activeCompanies: 2, activeUsers: 4, activeForms: 1 });
            const request = flushAppointments('ADMIN', []);
            expect(request.request.params.has('from')).toBeTrue();
            expect(request.request.params.has('userId')).toBeFalse();
            expect(texts('.figures__row')).toEqual(['Empresas activas 2', 'Formularios activos 1', 'Usuarios activos 4']);
        });

        it('el ergonomista lee solo su agenda y no pide las cifras, que el backend reserva al administrador', () => {
            open('ERGONOMIST');
            const request = flushAppointments('ERGONOMIST', []);
            expect(request.request.params.get('userId')).toBe(String(ME));
            http.expectNone(SUMMARY_URL);
            expect(element.querySelector('.figures')).toBeNull();
        });

        it('muestra un guion en las cifras cuando el backend responde con error, sin inventarlas', () => {
            open('ADMIN');
            http.expectOne(SUMMARY_URL).flush(null, { status: 500, statusText: 'Server Error' });
            flushAppointments('ADMIN', []);
            expect(texts('.figures dd')).toEqual(['—', '—', '—']);
        });
    });

    describe('hoy', () => {
        it('cuenta las citas del día y avisa cuál está en curso', () => {
            openAdmin([appointmentOf(1, 'Ana Mora', minutesFromNow(-30), { userId: OTHER }), appointmentOf(2, 'Luis Rojas', minutesFromNow(90))]);
            expect(text('.dashboard__line')).toBe('Hoy hay 2 citas. La de Ana Mora está en curso.');
        });

        it('le habla al ergonomista de sus propias citas', () => {
            open('ERGONOMIST');
            flushAppointments('ERGONOMIST', []);
            expect(text('.dashboard__line')).toBe('No tiene citas hoy.');
            expect(text('.day__message')).toBe('No tiene citas agendadas para hoy.');
        });

        it('dibuja una fila por ergonomista, con la propia primero como "Usted", y deja fuera las canceladas', () => {
            openAdmin([appointmentOf(1, 'Ana Mora', minutesFromNow(-30), { userId: OTHER }), appointmentOf(2, 'Luis Rojas', minutesFromNow(90)), appointmentOf(3, 'Pedro Vega', minutesFromNow(120), { userId: OTHER, status: 'CANCELLED' })]);
            expect(texts('.day__owner')).toEqual(['Usted', 'Keisy Rojas']);
            expect(texts('.day__block strong')).toEqual(['Luis Rojas', 'Ana Mora']);
            expect(element.querySelector('.day__block--now strong')?.textContent).toBe('Ana Mora');
        });

        it('ubica cada cita en su hora dentro de la regla', () => {
            open('ERGONOMIST');
            flushAppointments('ERGONOMIST', [appointmentOf(1, 'Ana Mora', dayAt(0, 9)), appointmentOf(2, 'Luis Rojas', dayAt(0, 15))]);
            const blocks = Array.from(element.querySelectorAll<HTMLElement>('.day__block'));
            // Working day from 8:00 to 17:00: 9:00 is one ninth in, 15:00 is seven ninths in.
            expect(parseFloat(blocks[0].style.left)).toBeCloseTo(100 / 9, 1);
            expect(parseFloat(blocks[1].style.left)).toBeCloseTo(700 / 9, 1);
            expect(parseFloat(blocks[0].style.width)).toBeCloseTo(100 / 9, 1);
            expect(element.querySelector('.day__owner')).withContext('el ergonomista no necesita el nombre de la fila').toBeNull();
        });

        it('permite reintentar cuando no se pudieron leer las citas', () => {
            open('ERGONOMIST');
            http.expectOne((candidate) => candidate.url === AGENDA_URL).flush(null, { status: 500, statusText: 'Server Error' });
            fixture.detectChanges();
            expect(text('.day__message')).toContain('No se pudieron cargar las citas.');
            element.querySelector<HTMLButtonElement>('.day__retry')!.click();
            flushAppointments('ERGONOMIST', []);
            expect(text('.day__message')).toBe('No tiene citas agendadas para hoy.');
        });
    });

    describe('próximos días', () => {
        it('lista las citas pendientes después de hoy, sin las canceladas', () => {
            open('ERGONOMIST');
            flushAppointments('ERGONOMIST', [
                appointmentOf(1, 'Hoy Mismo', minutesFromNow(60)),
                appointmentOf(2, 'Pedro Vega', dayAt(1, 9), { status: 'CONFIRMED' }),
                appointmentOf(3, 'Cancelada', dayAt(2, 9), { status: 'CANCELLED' }),
                appointmentOf(4, 'Sofía Araya', dayAt(3, 8))
            ]);
            expect(texts('.panel .rows__who strong').slice(0, 2)).toEqual(['Pedro Vega', 'Sofía Araya']);
            expect(texts('.rows__meta')).toEqual(['Confirmada', 'Agendada']);
        });

        it('invita a revisar la agenda cuando no hay citas próximas', () => {
            openAdmin([]);
            expect(texts('.panel__empty')).toContain('No hay citas en los próximos 7 días.');
        });
    });

    describe('por registrar', () => {
        const attended = appointmentOf(7, 'Laura Méndez', dayAt(-2, 9));

        it('muestra las citas propias ya atendidas sin evaluación y abre su registro', () => {
            open('ERGONOMIST');
            flushAppointments('ERGONOMIST', [attended, appointmentOf(8, 'Evaluada', dayAt(-3, 9), { evaluated: true }), appointmentOf(9, 'Cancelada', dayAt(-1, 9), { status: 'CANCELLED' })]);
            const items = Array.from(element.querySelectorAll<HTMLElement>('.rows__item--action'));
            expect(items.map((item) => item.querySelector('strong')?.textContent)).toEqual(['Laura Méndez']);
            items[0].querySelector<HTMLButtonElement>('.rows__action')!.click();
            expect(navigateSpy).toHaveBeenCalledWith(['/personalized-evaluations'], { queryParams: { appointmentId: 7 } });
        });

        it('al administrador solo le aparece cuando tiene citas propias pendientes de registrar', () => {
            openAdmin([{ ...attended, userId: OTHER }]);
            expect(texts('.panel__title')).not.toContain('Por registrar');
        });

        it('le confirma al ergonomista cuando no tiene evaluaciones pendientes', () => {
            open('ERGONOMIST');
            flushAppointments('ERGONOMIST', []);
            expect(texts('.panel__empty')).toContain('Todas sus citas atendidas tienen su evaluación.');
        });
    });
});
