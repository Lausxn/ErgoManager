import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MenuItem } from 'primeng/api';

import { appRoutes } from '../../../app.routes';
import { accountRoutes } from '../../pages/account/account.routes';
import { LoginResponse } from '../../shared/models/auth.model';
import { Role } from '../../shared/models/role.model';
import { AppMenu } from './app.menu';

const SESSION_STORAGE_KEY = 'ergomanager.session';

/**
 * Screen that each menu entry has to open according to its name.
 */
const EXPECTED_LINKS: Record<string, string> = {
    Empresas: '/companies',
    Usuarios: '/users',
    Formularios: '/forms',
    Agenda: '/appointments',
    'Evaluación personalizada': '/personalized-evaluations',
    Historial: '/history',
    'Cambiar contraseña': '/account/password'
};

/**
 * Builds the session of a signed in user with the given role.
 *
 * @param role role of the user
 * @returns stored session
 */
function sessionOf(role: Role): LoginResponse {
    return { token: 'token', tokenType: 'Bearer', expiresAtMs: Number.MAX_SAFE_INTEGER, userId: 1, fullName: 'Usuario Prueba', role };
}

/**
 * Checks that an url matches a screen registered in the routes.
 *
 * @param url absolute url of a menu entry
 * @returns true when the screen exists
 */
function isRegistered(url: string): boolean {
    const layout = appRoutes.find((route) => route.path === '' && route.children);
    const layoutPaths = (layout?.children ?? []).map((route) => route.path);
    const [first, second] = url.replace(/^\//, '').split('/');
    if (first === 'account') {
        return accountRoutes.some((route) => route.path === second);
    }
    return layoutPaths.includes(first);
}

/**
 * Creates the menu for a user with the given role and returns its visible entries.
 *
 * @param role role of the signed in user
 * @returns entries with a router link that the role can see
 */
function visibleEntries(role: Role): MenuItem[] {
    TestBed.resetTestingModule();
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessionOf(role)));
    TestBed.configureTestingModule({
        imports: [AppMenu],
        providers: [provideRouter([]), provideHttpClient()]
    });
    const menu = TestBed.createComponent(AppMenu).componentInstance as unknown as { model: () => MenuItem[] };
    return menu
        .model()
        .filter((section) => section.visible !== false)
        .flatMap((section) => section.items ?? [])
        .filter((item) => item.visible !== false && item.routerLink);
}

describe('AppMenu', () => {
    afterEach(() => {
        localStorage.removeItem(SESSION_STORAGE_KEY);
    });

    it('lleva cada entrada del administrador a la pantalla que corresponde a su nombre', () => {
        for (const item of visibleEntries('ADMIN').filter((entry) => entry.label !== 'Inicio')) {
            expect(item.routerLink).withContext(item.label!).toEqual([EXPECTED_LINKS[item.label!]]);
            expect(isRegistered(item.routerLink[0])).withContext(item.label!).toBeTrue();
        }
    });

    it('lleva Inicio al dashboard para el administrador', () => {
        const home = visibleEntries('ADMIN').find((entry) => entry.label === 'Inicio');
        expect(home?.routerLink).toEqual(['/dashboard']);
    });

    it('lleva Inicio a la agenda para el ergonomista, que no tiene dashboard', () => {
        const home = visibleEntries('ERGONOMIST').find((entry) => entry.label === 'Inicio');
        expect(home?.routerLink).toEqual(['/appointments']);
    });

    it('muestra la sección Administración solo al administrador', () => {
        const ergonomistLabels = visibleEntries('ERGONOMIST').map((entry) => entry.label);
        expect(ergonomistLabels).not.toContain('Usuarios');
        expect(ergonomistLabels).not.toContain('Empresas');
        expect(ergonomistLabels).not.toContain('Formularios');
    });

    it('muestra Evaluación personalizada solo al ergonomista', () => {
        expect(visibleEntries('ADMIN').map((entry) => entry.label)).not.toContain('Evaluación personalizada');
        expect(visibleEntries('ERGONOMIST').map((entry) => entry.label)).toContain('Evaluación personalizada');
    });
});
