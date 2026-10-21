import { Component } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { Route, provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { appRoutes } from '../../../../app.routes';
import { environment } from '../../../../environments/environment';
import { LoginResponse } from '../../../shared/models/auth.model';
import { CompanyResponse } from '../../../shared/models/company.model';
import { Role } from '../../../shared/models/role.model';

const SESSION_STORAGE_KEY = 'ergomanager.session';

const COMPANIES_URL = `${environment.apiUrl}/companies`;

/** Active company deactivated in the tests. */
const ACTIVE_COMPANY: CompanyResponse = {
    id: 4,
    businessName: 'Industrias del Valle',
    taxId: '3-101-000001',
    contactEmail: 'rrhh@valle.test',
    active: true,
    createdAt: '2026-10-01T10:00:00'
};

/** Company deactivated before, reactivated in the tests. */
const INACTIVE_COMPANY: CompanyResponse = { ...ACTIVE_COMPANY, id: 9, businessName: 'Café Sol', taxId: '3-101-000002', active: false };

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
    describe(`Task117 HU-021: opciones de Desactivar perfil conectadas al backend (${role})`, () => {
        let harness: RouterTestingHarness;
        let http: HttpTestingController;

        beforeEach(async () => {
            localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessionOf(role)));
            TestBed.configureTestingModule({
                providers: [provideRouter([companiesRoute(), { path: 'auth/access', component: AccessDeniedStubComponent }], withComponentInputBinding()), provideHttpClient(), provideHttpClientTesting(), provideNoopAnimations()]
            });
            http = TestBed.inject(HttpTestingController);
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

        /** Pop-up shown on screen, or null when it is closed. */
        function dialog(): HTMLElement | null {
            return document.querySelector('.deactivate-company');
        }

        /** Waits until the pop-up and the page finish their changes. */
        async function settle(): Promise<void> {
            harness.detectChanges();
            await harness.fixture.whenStable();
            harness.detectChanges();
        }

        /** Opens the list of companies, the page of the dashboard option. */
        async function openList(): Promise<void> {
            await harness.navigateByUrl('/companies');
            http.expectOne({ method: 'GET', url: COMPANIES_URL }).flush([ACTIVE_COMPANY, INACTIVE_COMPANY]);
            harness.detectChanges();
        }

        /**
         * Finds the row of a company in the table.
         *
         * @param businessName name of the company
         * @returns the row
         */
        function rowOf(businessName: string): HTMLElement {
            const row = Array.from(page().querySelectorAll<HTMLElement>('tbody tr')).find((element) => element.textContent?.includes(businessName));
            expect(row).withContext(`fila de ${businessName}`).toBeDefined();
            return row!;
        }

        /**
         * Clicks an action of a company row by its accessible name.
         *
         * @param businessName name of the company
         * @param label        accessible name of the action
         */
        async function clickRowAction(businessName: string, label: string): Promise<void> {
            rowOf(businessName).querySelector<HTMLElement>(`button[aria-label="${label}"]`)!.click();
            await settle();
        }

        /**
         * Clicks a button of the pop-up by its text.
         *
         * @param label text of the button
         */
        async function clickDialogButton(label: string): Promise<void> {
            Array.from(dialog()!.querySelectorAll('button'))
                .find((element) => element.textContent?.trim() === label)!
                .click();
            await settle();
        }

        /** Values of the summary cards: registered, active and inactive companies. */
        function summary(): string[] {
            return Array.from(page().querySelectorAll('.mgs-stat__value')).map((value) => value.textContent?.trim() ?? '');
        }

        it('"Desactivar empresa" abre el pop-up de esa empresa sin llamar todavía al backend', async () => {
            await openList();
            await clickRowAction(ACTIVE_COMPANY.businessName, 'Desactivar empresa');

            http.expectNone({ method: 'DELETE', url: `${COMPANIES_URL}/${ACTIVE_COMPANY.id}` });
            expect(dialog()!.querySelector('h2')!.textContent!.trim()).toBe('¿Está seguro de desactivar este perfil?');
            expect(dialog()!.textContent).toContain(ACTIVE_COMPANY.businessName);
            expect(dialog()!.textContent).toContain(`Cédula jurídica ${ACTIVE_COMPANY.taxId}`);
        });

        it('el pop-up informa lo que bloquea el backend al desactivar', async () => {
            await openList();
            await clickRowAction(ACTIVE_COMPANY.businessName, 'Desactivar empresa');

            const effects = dialog()!.querySelector('[aria-label="Qué ocurre al desactivar el perfil"]')!.textContent!;
            expect(effects).toContain('Dejará de recibir formularios');
            expect(effects).toContain('no podrán responder desde el enlace');
            expect(effects).toContain('No se podrán agendar citas ni registrar evaluaciones personalizadas');
            expect(effects).toContain('Las evaluaciones y el historial se conservan');
        });

        it('"Cancelar" cierra el pop-up y la empresa sigue activa', async () => {
            await openList();
            await clickRowAction(ACTIVE_COMPANY.businessName, 'Desactivar empresa');
            await clickDialogButton('Cancelar');

            http.expectNone({ method: 'DELETE', url: `${COMPANIES_URL}/${ACTIVE_COMPANY.id}` });
            expect(dialog()).toBeNull();
            expect(rowOf(ACTIVE_COMPANY.businessName).querySelector('button[aria-label="Desactivar empresa"]')).not.toBeNull();
        });

        it('"Desactivar" envía DELETE /api/companies/{id} y la empresa pasa a inactiva', async () => {
            await openList();
            expect(summary()).toEqual(['2', '1', '1']);
            await clickRowAction(ACTIVE_COMPANY.businessName, 'Desactivar empresa');
            await clickDialogButton('Desactivar');

            http.expectOne({ method: 'DELETE', url: `${COMPANIES_URL}/${ACTIVE_COMPANY.id}` }).flush(null, { status: 204, statusText: 'No Content' });
            await settle();

            expect(dialog()).toBeNull();
            expect(rowOf(ACTIVE_COMPANY.businessName).textContent).toContain('Inactiva');
            expect(rowOf(ACTIVE_COMPANY.businessName).querySelector('button[aria-label="Reactivar empresa"]')).not.toBeNull();
            expect(summary()).toEqual(['2', '0', '2']);
        });

        it('si el backend rechaza la desactivación, la empresa sigue activa', async () => {
            await openList();
            await clickRowAction(ACTIVE_COMPANY.businessName, 'Desactivar empresa');
            await clickDialogButton('Desactivar');

            http.expectOne({ method: 'DELETE', url: `${COMPANIES_URL}/${ACTIVE_COMPANY.id}` }).flush({ status: 404, message: 'No se encontró la empresa.' }, { status: 404, statusText: 'Not Found' });
            await settle();

            expect(dialog()).toBeNull();
            expect(rowOf(ACTIVE_COMPANY.businessName).textContent).toContain('Activa');
            expect(rowOf(ACTIVE_COMPANY.businessName).querySelector('button[aria-label="Desactivar empresa"]')).not.toBeNull();
        });

        it('"Reactivar empresa" envía PATCH /api/companies/{id}/activate y la empresa vuelve a activa', async () => {
            await openList();
            await clickRowAction(INACTIVE_COMPANY.businessName, 'Reactivar empresa');

            http.expectOne({ method: 'PATCH', url: `${COMPANIES_URL}/${INACTIVE_COMPANY.id}/activate` }).flush({ ...INACTIVE_COMPANY, active: true });
            await settle();

            expect(rowOf(INACTIVE_COMPANY.businessName).querySelector('button[aria-label="Desactivar empresa"]')).not.toBeNull();
            expect(summary()).toEqual(['2', '2', '0']);
        });

        it('el perfil de una empresa inactiva muestra su estado y avisa que el enlace no acepta respuestas', async () => {
            await harness.navigateByUrl(`/companies/${INACTIVE_COMPANY.id}`);
            // The edit form may also read the list to check repeated values.
            http.match({ method: 'GET', url: COMPANIES_URL }).forEach((request) => request.flush([ACTIVE_COMPANY, INACTIVE_COMPANY]));
            http.expectOne({ method: 'GET', url: `${COMPANIES_URL}/${INACTIVE_COMPANY.id}` }).flush(INACTIVE_COMPANY);
            harness.detectChanges();

            expect(page().textContent).toContain('Inactiva');
            expect(page().textContent).toContain('La empresa está inactiva: el enlace no aceptará respuestas hasta reactivarla.');
        });
    });
}
