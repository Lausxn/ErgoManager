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
    Citas: '/appointments',
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
    return { token: 'token', tokenType: 'Bearer', expiresAtMs: Number.MAX_SAFE_INTEGER, userId: 1, fullName: 'Usuario Prueba', role, mustChangePassword: false };
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

    it('lleva cada entrada de cada rol a la pantalla que corresponde a su nombre', () => {
        for (const role of ['ADMIN', 'ERGONOMIST'] as const) {
            for (const item of visibleEntries(role)) {
                expect(item.routerLink).withContext(`${role} ${item.label}`).toEqual([EXPECTED_LINKS[item.label!]]);
                expect(isRegistered(item.routerLink[0])).withContext(`${role} ${item.label}`).toBeTrue();
            }
        }
    });

    it('muestra Gestión de usuarios solo al administrador', () => {
        expect(visibleEntries('ADMIN').map((entry) => entry.label)).toContain('Usuarios');
        expect(visibleEntries('ERGONOMIST').map((entry) => entry.label)).not.toContain('Usuarios');
    });

    it('ordena el menú por etapas del trabajo, igual para ambos roles, y suma Administración solo al administrador', () => {
        const sectionsOf = (role: Role) => {
            TestBed.resetTestingModule();
            localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessionOf(role)));
            TestBed.configureTestingModule({ imports: [AppMenu], providers: [provideRouter([]), provideHttpClient()] });
            const model = (TestBed.createComponent(AppMenu).componentInstance as unknown as { model: () => MenuItem[] }).model();
            return model.filter((section) => section.visible !== false).map((section) => [section.label, (section.items ?? []).filter((item) => item.visible !== false).map((item) => item.label)]);
        };
        const work = [
            ['Preparación', ['Empresas', 'Formularios']],
            ['Atención', ['Citas', 'Evaluación personalizada']],
            ['Seguimiento', ['Historial']]
        ];
        const temporal = ['Temporal', ['Autoevaluación pública', 'Cambiar contraseña']];
        expect(sectionsOf('ERGONOMIST')).toEqual([...work, temporal]);
        expect(sectionsOf('ADMIN')).toEqual([...work, ['Administración', ['Usuarios']], temporal]);
    });

    it('da al ergonomista acceso a Formularios y Empresas', () => {
        const ergonomistLabels = visibleEntries('ERGONOMIST').map((entry) => entry.label);
        expect(ergonomistLabels).toContain('Formularios');
        expect(ergonomistLabels).toContain('Empresas');
    });

    it('muestra Evaluación personalizada a ambos roles, porque el administrador también atiende citas', () => {
        expect(visibleEntries('ADMIN').map((entry) => entry.label)).toContain('Evaluación personalizada');
        expect(visibleEntries('ERGONOMIST').map((entry) => entry.label)).toContain('Evaluación personalizada');
    });

    it('agrupa Agenda y Disponibilidad en una sola entrada Citas para ambos roles', () => {
        for (const role of ['ADMIN', 'ERGONOMIST'] as const) {
            const labels = visibleEntries(role).map((entry) => entry.label);
            expect(labels).withContext(role).toContain('Citas');
            expect(labels).withContext(role).not.toContain('Agenda');
            expect(labels).withContext(role).not.toContain('Disponibilidad');
        }
    });

    it('agrupa los accesos temporales de Autoevaluación pública y Cambiar contraseña bajo un mismo título', () => {
        TestBed.resetTestingModule();
        localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessionOf('ADMIN')));
        TestBed.configureTestingModule({ imports: [AppMenu], providers: [provideRouter([]), provideHttpClient()] });
        const sections = (TestBed.createComponent(AppMenu).componentInstance as unknown as { model: () => MenuItem[] }).model();
        const temporal = sections.find((section) => section.label === 'Temporal');
        expect(temporal?.items?.map((item) => item.label)).toEqual(['Autoevaluación pública', 'Cambiar contraseña']);
        expect(sections.map((section) => section.label)).not.toContain('Empleados');
        expect(sections.map((section) => section.label)).not.toContain('Cuenta');
    });

    it('mantiene resaltadas Citas y Formularios en todas las pantallas de su sección', () => {
        for (const role of ['ADMIN', 'ERGONOMIST'] as const) {
            for (const label of ['Citas', 'Formularios']) {
                const entry = visibleEntries(role).find((candidate) => candidate.label === label);
                expect(entry?.routerLinkActiveOptions?.paths).withContext(`${role} ${label}`).toBe('subset');
            }
        }
    });
});
