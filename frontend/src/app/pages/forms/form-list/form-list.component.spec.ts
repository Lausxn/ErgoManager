import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { Router, provideRouter } from '@angular/router';

import { environment } from '../../../../environments/environment';
import { FormListComponent } from './form-list.component';
import { FormSection } from '../form-navigation/form-navigation.component';
import { formsRoutes } from '../forms.routes';

const FORMS_URL = `${environment.apiUrl}/forms`;

describe('Forms workspace', () => {
    let fixture: ComponentFixture<FormListComponent>;
    let http: HttpTestingController;

    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [FormListComponent],
            providers: [provideRouter([]), provideNoopAnimations(), provideHttpClient(), provideHttpClientTesting()]
        });
        http = TestBed.inject(HttpTestingController);
    });

    afterEach(() => http.verify());

    function open(section: FormSection): HTMLElement {
        fixture = TestBed.createComponent(FormListComponent);
        fixture.componentRef.setInput('section', section);
        fixture.detectChanges();
        return fixture.nativeElement;
    }

    it('offers separate destinations for each form category from the overview', () => {
        const element = open('overview');
        http.expectOne(FORMS_URL).flush([]);
        fixture.detectChanges();
        const links = Array.from(element.querySelectorAll<HTMLAnchorElement>('nav a'));
        expect(links.map((link) => link.getAttribute('href'))).toEqual(['/forms', '/forms/self-evaluation', '/forms/personalized']);
        expect(links[0].getAttribute('aria-current')).toBe('page');
        expect(element.textContent).toContain('Formularios para colaboradores');
        expect(element.textContent).toContain('Formularios para el ergonomista');
        expect(element.querySelector('p-table')).toBeNull();
    });

    it('shows the self evaluation list and actions for both availability states', () => {
        const element = open('self-evaluation');
        http.expectOne(FORMS_URL).flush([
            { id: 1, title: 'Puesto de trabajo', publicationYear: 2026, active: true, questionList: [] },
            { id: 2, title: 'Seguimiento', publicationYear: 2025, active: false, questionList: [] }
        ]);
        fixture.detectChanges();
        expect(element.textContent).toContain('Puesto de trabajo');
        expect(element.textContent).toContain('Seguimiento');
        expect(element.querySelector('button[aria-label="Desactivar formulario"]')).not.toBeNull();
        expect(element.querySelector('button[aria-label="Activar formulario"]')).not.toBeNull();
    });

    it('does not present self evaluation records as personalized forms or call their API', () => {
        const element = open('personalized');
        http.expectNone(FORMS_URL);
        expect(element.textContent).toContain('todavía no están disponibles');
        expect(element.querySelector('p-table')).toBeNull();
        const router = TestBed.inject(Router);
        const navigate = spyOn(router, 'navigateByUrl').and.resolveTo(true);
        const prepare = Array.from(element.querySelectorAll('button')).find((button) => button.textContent?.includes('Preparar formulario personalizado'))!;
        prepare.click();
        expect(router.serializeUrl(navigate.calls.mostRecent().args[0] as import('@angular/router').UrlTree)).toBe('/forms/personalized/new');
    });

    it('shows a retry action when the overview request fails', () => {
        const element = open('overview');
        http.expectOne(FORMS_URL).flush({}, { status: 503, statusText: 'Unavailable' });
        fixture.detectChanges();
        expect(element.textContent).toContain('No se pudo cargar el resumen');
        const retry = Array.from(element.querySelectorAll('button')).find((button) => button.textContent?.includes('Reintentar'))!;
        retry.click();
        http.expectOne(FORMS_URL).flush([]);
    });

    it('registers category routes before the parameterized editor route', () => {
        expect(formsRoutes.find((route) => route.path === '')?.data?.['section']).toBe('overview');
        const paths = formsRoutes.map((route) => route.path);
        for (const path of ['self-evaluation', 'personalized', 'personalized/new']) {
            expect(paths.indexOf(path)).toBeLessThan(paths.indexOf(':id'));
        }
        expect(formsRoutes.find((route) => route.path === 'personalized/new')?.data?.['category']).toBe('personalized');
    });
});
