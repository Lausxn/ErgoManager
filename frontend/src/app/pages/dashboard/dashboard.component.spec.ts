import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { appRoutes } from '../../../app.routes';
import { environment } from '../../../environments/environment';
import { LoginResponse } from '../../shared/models/auth.model';
import { DashboardComponent } from './dashboard.component';

const SESSION_STORAGE_KEY = 'ergomanager.session';

const ADMIN_SESSION: LoginResponse = {
    token: 'token',
    tokenType: 'Bearer',
    expiresAtMs: Number.MAX_SAFE_INTEGER,
    userId: 1,
    fullName: 'Admin Prueba',
    role: 'ADMIN'
};

/**
 * Screen that each option has to open according to its name and description.
 * Null marks an option whose function does not exist in the backend yet.
 */
const EXPECTED_ROUTES: Record<string, string | null> = {
    Formularios: '/forms',
    Citas: '/appointments',
    'Perfiles de clientes': '/companies',
    Reportes: null,
    'Gestión de usuarios': '/users'
};

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
    let component: DashboardComponent;
    let httpTesting: HttpTestingController;
    let navigateSpy: jasmine.Spy;

    beforeEach(() => {
        localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(ADMIN_SESSION));
        TestBed.configureTestingModule({
            imports: [DashboardComponent],
            providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()]
        });
        httpTesting = TestBed.inject(HttpTestingController);
        navigateSpy = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
        fixture = TestBed.createComponent(DashboardComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    afterEach(() => {
        localStorage.removeItem(SESSION_STORAGE_KEY);
    });

    /**
     * Answers the three figures that the dashboard reads from the backend.
     */
    function answerStats(companies: object[], users: object[], forms: object[]): void {
        httpTesting.expectOne({ method: 'GET', url: `${environment.apiUrl}/companies` }).flush(companies);
        httpTesting.expectOne({ method: 'GET', url: `${environment.apiUrl}/users` }).flush(users);
        httpTesting.expectOne({ method: 'GET', url: `${environment.apiUrl}/forms/active` }).flush(forms);
        fixture.detectChanges();
    }

    /**
     * Reads the value shown by a figure.
     *
     * @param label label of the figure
     * @returns text of the figure without the label
     */
    function statText(label: string): string {
        const card: HTMLElement = fixture.nativeElement.querySelector(`[data-stat="${label}"]`);
        return card.textContent!.replace(label, '').trim();
    }

    describe('opciones', () => {
        it('muestra las cinco opciones del perfil administrador', () => {
            expect(component.functionCards.map((card) => card.title)).toEqual(Object.keys(EXPECTED_ROUTES));
        });

        it('asigna cada opción a la pantalla que corresponde a su nombre', () => {
            for (const card of component.functionCards) {
                expect(card.route).withContext(card.title).toBe(EXPECTED_ROUTES[card.title]);
            }
        });

        it('solo apunta a pantallas registradas en las rutas de la aplicación', () => {
            const urls = layoutUrls();
            for (const card of component.functionCards.filter((option) => option.route !== null)) {
                expect(urls).withContext(card.title).toContain(card.route!);
            }
        });

        it('abre la pantalla de cada opción al hacer clic', () => {
            for (const card of component.functionCards.filter((option) => option.route !== null)) {
                navigateSpy.calls.reset();
                fixture.nativeElement.querySelector(`[data-card="${card.title}"]`).click();
                expect(navigateSpy).withContext(card.title).toHaveBeenCalledOnceWith([card.route]);
            }
        });

        it('marca como Próximamente la opción sin función en el backend y no navega', () => {
            const reports: HTMLElement = fixture.nativeElement.querySelector('[data-card="Reportes"]');
            reports.click();

            expect(navigateSpy).not.toHaveBeenCalled();
            expect(reports.getAttribute('aria-disabled')).toBe('true');
            expect(reports.textContent).toContain('Próximamente');
        });
    });

    describe('estadísticas', () => {
        it('saluda con el nombre del usuario de la sesión', () => {
            expect(fixture.nativeElement.querySelector('.greeting-title').textContent).toContain('Admin.');
        });

        it('lee cada cifra de su endpoint y cuenta solo los registros activos', () => {
            answerStats(
                [{ active: true }, { active: true }, { active: false }],
                [{ active: true }, { active: false }],
                [{ active: true }, { active: true }, { active: true }]
            );

            expect(statText('Clientes activos')).toBe('2');
            expect(statText('Usuarios activos')).toBe('1');
            expect(statText('Formularios activos')).toBe('3');
        });

        it('muestra No disponible cuando el backend responde con error', () => {
            const error = { status: 500, statusText: 'Internal Server Error' };
            httpTesting.expectOne(`${environment.apiUrl}/companies`).flush(null, error);
            httpTesting.expectOne(`${environment.apiUrl}/users`).flush(null, error);
            httpTesting.expectOne(`${environment.apiUrl}/forms/active`).flush(null, error);
            fixture.detectChanges();

            expect(statText('Clientes activos')).toBe('No disponible');
            expect(statText('Usuarios activos')).toBe('No disponible');
            expect(statText('Formularios activos')).toBe('No disponible');
        });

        it('no inventa las citas programadas, que no tienen endpoint en el backend', () => {
            answerStats([], [], []);

            httpTesting.verify();
            expect(statText('Citas programadas')).toBe('No disponible');
        });
    });
});
