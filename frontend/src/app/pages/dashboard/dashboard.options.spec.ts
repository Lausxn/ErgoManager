import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { appRoutes } from '../../../app.routes';
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
 * Returns the urls of the screens shown inside the main layout.
 *
 * @returns absolute urls of the layout children
 */
function layoutUrls(): string[] {
    const layout = appRoutes.find((route) => route.path === '' && route.children);
    return (layout?.children ?? []).filter((route) => route.path).map((route) => `/${route.path}`);
}

/** Checks the options and figures of the administrator dashboard (Task 30). */
describe('DashboardComponent options (Task 30)', () => {
    let fixture: ComponentFixture<DashboardComponent>;
    let element: HTMLElement;

    beforeEach(() => {
        localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(ADMIN_SESSION));
        TestBed.configureTestingModule({
            imports: [DashboardComponent],
            providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()]
        });
        fixture = TestBed.createComponent(DashboardComponent);
        fixture.detectChanges();
        element = fixture.nativeElement;
    });

    afterEach(() => {
        localStorage.removeItem(SESSION_STORAGE_KEY);
    });

    it('greets the signed in administrator by first name in the shared page header', () => {
        const title = element.querySelector('app-page-header .mgs-title');
        expect(title?.textContent).toContain('Admin.');
    });

    it('links every enabled option to a screen that exists in the layout', () => {
        const urls = layoutUrls();
        for (const card of fixture.componentInstance.functionCards.filter((item) => item.route !== null)) {
            expect(urls).withContext(card.title).toContain(card.route!);
            const option = element.querySelector(`[data-card="${card.title}"]`);
            expect(option?.getAttribute('href')).withContext(card.title).toBe(card.route);
        }
    });

    it('shows Reportes as not available instead of opening another screen', () => {
        const reports = element.querySelector('[data-card="Reportes"]');
        expect(reports?.getAttribute('href')).toBeNull();
        expect(reports?.getAttribute('aria-disabled')).toBe('true');
        expect(reports?.textContent).toContain('Próximamente');
    });

    it('never starts with invented figures', () => {
        const stats = fixture.componentInstance.stats();
        expect(stats.map((stat) => stat.label)).toEqual(['Citas programadas', 'Clientes activos', 'Usuarios activos', 'Formularios activos']);
        stats.forEach((stat) => expect(stat.value).withContext(stat.label).toBeNull());
        expect(element.querySelectorAll('[data-stat] .mgs-kpi').length).toBe(0);
    });
});
