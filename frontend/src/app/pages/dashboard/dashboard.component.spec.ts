import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { appRoutes } from '../../../app.routes';
import { environment } from '../../../environments/environment';
import { LoginResponse } from '../../shared/models/auth.model';
import { Role } from '../../shared/models/role.model';
import { DashboardComponent } from './dashboard.component';

const SESSION_STORAGE_KEY = 'ergomanager.session';

const SUMMARY_URL = `${environment.apiUrl}/dashboard/summary`;

/** Screen that each option has to open according to its name, per profile. */
const EXPECTED_ROUTES: Record<Role, Record<string, string>> = {
    ADMIN: {
        Formularios: '/forms',
        'Agenda de citas': '/appointments',
        'Perfiles de clientes': '/companies',
        'Reportes e historial': '/history',
        'Gestión de usuarios': '/users'
    },
    ERGONOMIST: {
        Formularios: '/forms',
        'Agenda de citas': '/appointments',
        'Perfiles de clientes': '/companies',
        'Evaluación personalizada': '/personalized-evaluations',
        'Reportes e historial': '/history'
    }
};

/**
 * Builds the session of a signed in user with the given role.
 *
 * @param role role of the user
 * @returns stored session
 */
function sessionOf(role: Role): LoginResponse {
    return { token: 'token', tokenType: 'Bearer', expiresAtMs: Number.MAX_SAFE_INTEGER, userId: 1, fullName: 'Ana Prueba', role, mustChangePassword: false };
}

/**
 * Returns the urls of the screens shown inside the main layout.
 *
 * @returns absolute urls of the layout children
 */
function layoutUrls(): string[] {
    const layout = appRoutes.find((route) => route.path === '' && route.children);
    return (layout?.children ?? []).filter((route) => route.path).map((route) => `/${route.path}`);
}

describe('DashboardComponent', () => {
    let fixture: ComponentFixture<DashboardComponent>;
    let element: HTMLElement;
    let httpTesting: HttpTestingController;
    let navigateSpy: jasmine.Spy;

    /**
     * Opens the dashboard with the session of the given role.
     *
     * @param role role of the signed in user
     */
    function openAs(role: Role): void {
        localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessionOf(role)));
        TestBed.configureTestingModule({
            imports: [DashboardComponent],
            providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()]
        });
        httpTesting = TestBed.inject(HttpTestingController);
        // The options are router links, which navigate through navigateByUrl.
        navigateSpy = spyOn(TestBed.inject(Router), 'navigateByUrl').and.resolveTo(true);
        fixture = TestBed.createComponent(DashboardComponent);
        fixture.detectChanges();
        element = fixture.nativeElement;
    }

    /** Options shown on the page, with the screen each one opens. */
    function options(): { title: string; href: string | null }[] {
        return Array.from(element.querySelectorAll<HTMLAnchorElement>('.mgs-option')).map((option) => ({
            title: option.querySelector('.mgs-option__title')?.textContent?.trim() ?? '',
            href: option.getAttribute('href')
        }));
    }

    /** Values shown by the key figures, in order. */
    function figures(): string[] {
        return Array.from(element.querySelectorAll('.mgs-stat__value')).map((value) => value.textContent?.trim() ?? '');
    }

    afterEach(() => {
        httpTesting.verify();
        localStorage.removeItem(SESSION_STORAGE_KEY);
    });

    for (const role of ['ADMIN', 'ERGONOMIST'] as const) {
        describe(`perfil ${role}`, () => {
            beforeEach(() => {
                openAs(role);
                if (role === 'ADMIN') {
                    httpTesting.expectOne(SUMMARY_URL).flush({ scheduledAppointments: 3, activeCompanies: 2, activeUsers: 4, activeForms: 1 });
                    fixture.detectChanges();
                }
            });

            it('saluda con el primer nombre del usuario de la sesión', () => {
                expect(element.querySelector('.mgs-impact__title')?.textContent).toContain('Ana.');
            });

            it('muestra las cinco opciones del perfil, cada una con la pantalla que corresponde a su nombre', () => {
                const expected = EXPECTED_ROUTES[role];
                expect(options().map((option) => option.title)).toEqual(Object.keys(expected));
                for (const option of options()) {
                    expect(option.href).withContext(option.title).toBe(expected[option.title]);
                }
            });

            it('solo apunta a pantallas registradas en las rutas de la aplicación', () => {
                const urls = layoutUrls();
                for (const option of options()) {
                    expect(urls).withContext(option.title).toContain(option.href!);
                }
            });

            it('abre la pantalla de cada opción al hacer clic', () => {
                const first = element.querySelector<HTMLAnchorElement>('.mgs-option')!;
                first.click();
                expect(navigateSpy).toHaveBeenCalled();
                expect(navigateSpy.calls.mostRecent().args[0].toString()).toBe('/forms');
            });
        });
    }

    describe('indicadores del administrador', () => {
        it('lee las cifras del resumen del backend', () => {
            openAs('ADMIN');
            httpTesting.expectOne(SUMMARY_URL).flush({ scheduledAppointments: 3, activeCompanies: 2, activeUsers: 4, activeForms: 1 });
            fixture.detectChanges();
            expect(figures()).toEqual(['3', '2', '4', '1']);
        });

        it('muestra un guion cuando el backend responde con error, sin inventar cifras', () => {
            openAs('ADMIN');
            httpTesting.expectOne(SUMMARY_URL).flush(null, { status: 500, statusText: 'Server Error' });
            fixture.detectChanges();
            expect(figures()).toEqual(['—', '—', '—', '—']);
        });
    });

    describe('ergonomista', () => {
        it('no muestra los indicadores ni los pide al backend, que solo los da al administrador', () => {
            openAs('ERGONOMIST');
            httpTesting.expectNone(SUMMARY_URL);
            expect(element.querySelector('.mgs-stats')).toBeNull();
            expect(element.querySelector('.mgs-impact__eyebrow')?.textContent).toContain('Panel del ergonomista');
        });

        it('no ofrece la gestión de usuarios', () => {
            openAs('ERGONOMIST');
            expect(options().map((option) => option.title)).not.toContain('Gestión de usuarios');
        });
    });
});
