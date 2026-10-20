import { Component } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { Route, Router, provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { appRoutes } from '../../../../app.routes';
import { environment } from '../../../../environments/environment';
import { LoginResponse } from '../../../shared/models/auth.model';
import { CompanyResponse } from '../../../shared/models/company.model';
import { Role } from '../../../shared/models/role.model';

const SESSION_STORAGE_KEY = 'ergomanager.session';

const COMPANIES_URL = `${environment.apiUrl}/companies`;

/** Company opened for editing; it was renamed once, so it keeps a former name. */
const COMPANY: CompanyResponse = {
    id: 7,
    businessName: 'Comercial Norte',
    taxId: '3-101-000010',
    contactEmail: 'rrhh@norte.test',
    phoneNumber: '2222-3333',
    address: 'Heredia',
    active: true,
    createdAt: '2026-10-01T10:00:00',
    previousNames: ['Norte Distribuidora']
};

/** Another company whose former name stays reserved for it. */
const OTHER_COMPANY: CompanyResponse = {
    ...COMPANY,
    id: 8,
    businessName: 'Industrias del Valle',
    taxId: '3-101-000009',
    previousNames: ['Valle Industrial']
};

const RESERVED_MESSAGE = 'Ese nombre perteneció a otra empresa y queda reservado para ella. Agregue un distintivo, por ejemplo un número o la sede.';

/** Page shown by the role guard to the users without access. */
@Component({ standalone: true, template: 'Acceso denegado' })
class AccessDeniedStubComponent {}

/**
 * Route of the client companies exactly as the application declares it, with
 * its role guard and its lazy children.
 *
 * @returns the companies route of app.routes
 */
function companiesRoute(): Route {
    const layout = appRoutes.find((route) => route.path === '' && route.children);
    return layout!.children!.find((route) => route.path === 'companies')!;
}

/**
 * Builds the session of a signed in user with the given role.
 *
 * @param role role of the user
 * @returns stored session
 */
function sessionOf(role: Role): LoginResponse {
    return { token: 'token', tokenType: 'Bearer', expiresAtMs: Number.MAX_SAFE_INTEGER, userId: 1, fullName: 'Ana Prueba', role, mustChangePassword: false };
}

for (const role of ['ADMIN', 'ERGONOMIST'] as const) {
    describe(`Task114 HU-020: opciones de Editar perfil conectadas al backend (${role})`, () => {
        let harness: RouterTestingHarness;
        let http: HttpTestingController;
        let router: Router;

        beforeEach(async () => {
            localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessionOf(role)));
            TestBed.configureTestingModule({
                providers: [provideRouter([companiesRoute(), { path: 'auth/access', component: AccessDeniedStubComponent }], withComponentInputBinding()), provideHttpClient(), provideHttpClientTesting(), provideNoopAnimations()]
            });
            http = TestBed.inject(HttpTestingController);
            router = TestBed.inject(Router);
            harness = await RouterTestingHarness.create();
        });

        afterEach(() => {
            http.verify();
            localStorage.removeItem(SESSION_STORAGE_KEY);
        });

        /** Root element of the page shown by the router. */
        function page(): HTMLElement {
            return harness.routeNativeElement!;
        }

        /** Opens the list of companies, the entry point of the dashboard option. */
        async function openList(): Promise<void> {
            await harness.navigateByUrl('/companies');
            http.expectOne({ method: 'GET', url: COMPANIES_URL }).flush([COMPANY, OTHER_COMPANY]);
            harness.detectChanges();
        }

        /** Opens the edit profile page through its option in the list. */
        async function openEditFromList(): Promise<void> {
            await openList();
            page().querySelector<HTMLElement>(`button[aria-label="Editar perfil de ${COMPANY.businessName}"]`)!.click();
            await harness.fixture.whenStable();
            harness.detectChanges();
            http.expectOne({ method: 'GET', url: COMPANIES_URL }).flush([COMPANY, OTHER_COMPANY]);
            http.expectOne({ method: 'GET', url: `${COMPANIES_URL}/${COMPANY.id}` }).flush(COMPANY);
            harness.detectChanges();
        }

        /**
         * Types a value in a field, as the user would.
         *
         * @param id    id of the input
         * @param value text typed
         */
        function type(id: string, value: string): void {
            const input = page().querySelector<HTMLInputElement>(`#${id}`)!;
            input.value = value;
            input.dispatchEvent(new Event('input'));
            input.dispatchEvent(new Event('blur'));
            harness.detectChanges();
        }

        /**
         * Clicks a button of the page by its visible text.
         *
         * @param label text of the button
         */
        function clickButton(label: string): void {
            const button = Array.from(page().querySelectorAll('button')).find((element) => element.textContent?.trim() === label);
            expect(button).withContext(`botón "${label}"`).toBeDefined();
            button!.click();
            harness.detectChanges();
        }

        /**
         * Reads the message shown under a field.
         *
         * @param id id of the input
         * @returns text of the error, empty when there is none
         */
        function errorOf(id: string): string {
            return page().querySelector(`#${id}-error`)?.textContent?.trim() ?? '';
        }

        it('"Editar perfil" abre la empresa elegida y carga sus datos desde GET /api/companies/{id}', async () => {
            await openEditFromList();

            expect(router.url).toBe(`/companies/${COMPANY.id}`);
            expect(page().querySelector<HTMLInputElement>('#businessName')!.value).toBe(COMPANY.businessName);
            expect(page().querySelector<HTMLInputElement>('#taxId')!.value).toBe(COMPANY.taxId);
            expect(page().querySelector<HTMLInputElement>('#contactEmail')!.value).toBe(COMPANY.contactEmail);
        });

        it('"Nombres anteriores" muestra el historial que devuelve el backend', async () => {
            await openEditFromList();

            const history = page().querySelector('[aria-label="Nombres anteriores del perfil"]');
            expect(history?.textContent).toContain('Norte Distribuidora');
        });

        it('"Guardar cambios" envía PUT /api/companies/{id} con los datos editados y vuelve al listado', async () => {
            await openEditFromList();
            type('address', 'Alajuela');
            clickButton('Guardar cambios');

            const request = http.expectOne({ method: 'PUT', url: `${COMPANIES_URL}/${COMPANY.id}` });
            expect(request.request.body).toEqual({ businessName: COMPANY.businessName, taxId: COMPANY.taxId, contactEmail: COMPANY.contactEmail, phoneNumber: COMPANY.phoneNumber, address: 'Alajuela' });
            request.flush({ ...COMPANY, address: 'Alajuela' });
            await harness.fixture.whenStable();
            harness.detectChanges();
            http.expectOne({ method: 'GET', url: COMPANIES_URL }).flush([{ ...COMPANY, address: 'Alajuela' }, OTHER_COMPANY]);

            expect(router.url).toBe('/companies');
        });

        it('"Restablecer" recupera los datos cargados sin llamar al backend', async () => {
            await openEditFromList();
            type('address', 'Alajuela');
            clickButton('Restablecer');

            http.expectNone({ method: 'PUT', url: `${COMPANIES_URL}/${COMPANY.id}` });
            expect(page().querySelector<HTMLInputElement>('#address')!.value).toBe(COMPANY.address!);
        });

        it('"Volver a empresas" regresa al listado', async () => {
            await openEditFromList();
            clickButton('Volver a empresas');
            await harness.fixture.whenStable();
            harness.detectChanges();
            http.expectOne({ method: 'GET', url: COMPANIES_URL }).flush([COMPANY, OTHER_COMPANY]);

            expect(router.url).toBe('/companies');
        });

        it('"Copiar enlace" copia el enlace de autoevaluación de esa misma empresa', async () => {
            const clipboard = spyOn(navigator.clipboard, 'writeText').and.resolveTo();
            await openEditFromList();
            page().querySelector<HTMLElement>('button[aria-label="Copiar enlace de autoevaluación"]')!.click();

            expect(clipboard).toHaveBeenCalledWith(`${window.location.origin}/self-evaluation?companyId=${COMPANY.id}`);
        });

        it('reserva los nombres anteriores de otras empresas y permite recuperar uno propio', async () => {
            await openEditFromList();

            type('businessName', 'valle  industrial');
            expect(errorOf('businessName')).toBe(RESERVED_MESSAGE);

            type('businessName', 'Norte Distribuidora');
            expect(errorOf('businessName')).toBe('');
        });

        it('marca la razón social cuando el backend responde 409 por un nombre reservado', async () => {
            await openEditFromList();
            const renamedLater = { ...OTHER_COMPANY, previousNames: ['Valle Industrial', 'Valle Norte'] };
            type('businessName', 'Valle Norte');
            clickButton('Guardar cambios');

            http.expectOne({ method: 'PUT', url: `${COMPANIES_URL}/${COMPANY.id}` }).flush({ status: 409, message: RESERVED_MESSAGE }, { status: 409, statusText: 'Conflict' });
            http.expectOne({ method: 'GET', url: COMPANIES_URL }).flush([COMPANY, renamedLater]);
            harness.detectChanges();

            expect(errorOf('businessName')).toBe(RESERVED_MESSAGE);
            expect(errorOf('taxId')).toBe('');
        });
    });
}
