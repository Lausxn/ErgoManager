import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';

import { environment } from '../../../../environments/environment';
import { FormListComponent } from './form-list.component';
import { FormSection } from '../form-navigation/form-navigation.component';
import { formsRoutes } from '../forms.routes';

const FORMS_URL = `${environment.apiUrl}/forms`;

describe('Gestión de formularios', () => {
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

    it('muestra dos pestañas, el listado y un único botón de creación incluso sin registros', () => {
        const element = open('self-evaluation');
        http.expectOne(FORMS_URL).flush([]);
        fixture.detectChanges();
        const links = Array.from(element.querySelectorAll<HTMLAnchorElement>('nav a'));
        expect(links.map((link) => link.getAttribute('href'))).toEqual(['/forms/self-evaluation', '/forms/personalized']);
        expect(links[0].getAttribute('aria-current')).toBe('page');
        const createButtons = Array.from(element.querySelectorAll('button')).filter((button) => button.textContent?.trim() === 'Crear formulario');
        expect(createButtons.length).toBe(1);
        expect(element.querySelector('p-table')).not.toBeNull();
        expect(element.textContent).not.toContain('Ver autoevaluaciones');
    });

    it('muestra autoevaluaciones y acciones para ambos estados', () => {
        const element = open('self-evaluation');
        http.expectOne(FORMS_URL).flush([
            { id: 1, title: 'Puesto de trabajo', publicationYear: 2026, type: 'SELF_EVALUATION', active: true, questionList: [] },
            { id: 2, title: 'Seguimiento', publicationYear: 2025, type: 'SELF_EVALUATION', active: false, questionList: [] }
        ]);
        fixture.detectChanges();
        expect(element.textContent).toContain('Puesto de trabajo');
        expect(element.textContent).toContain('Seguimiento');
        expect(element.querySelector('button[aria-label="Desactivar formulario"]')).not.toBeNull();
        expect(element.querySelector('button[aria-label="Activar formulario"]')).not.toBeNull();
    });

    it('separa los formularios personalizados y no ofrece reenviarlos', () => {
        const element = open('personalized');
        http.expectOne(FORMS_URL).flush([
            { id: 1, title: 'Autoevaluación', type: 'SELF_EVALUATION', active: true, questionList: [] },
            { id: 2, title: 'Evaluación individual', type: 'PERSONALIZED_EVALUATION', active: true, questionList: [] },
            { id: 3, title: 'Borrador individual', type: 'PERSONALIZED_EVALUATION', active: false, questionList: [] }
        ]);
        fixture.detectChanges();
        expect(element.textContent).toContain('Evaluación individual');
        expect(element.textContent).toContain('Borrador individual');
        expect(fixture.componentInstance['filteredRows']().map((row) => row.id)).toEqual([2, 3]);
        expect(element.querySelector('button[aria-label="Reenviar formulario a una empresa"]')).toBeNull();
        expect(element.querySelector('button[aria-label="Activar formulario"]')).not.toBeNull();
        expect(element.querySelector('button[aria-label="Desactivar formulario"]')).not.toBeNull();
    });

    it('conserva el activo de cada tipo y presenta el rechazo del backend al activar otro', () => {
        open('self-evaluation');
        http.expectOne(FORMS_URL).flush([
            { id: 1, title: 'Auto', type: 'SELF_EVALUATION', active: true, questionList: [] },
            { id: 2, title: 'Personal', type: 'PERSONALIZED_EVALUATION', active: true, questionList: [] },
            { id: 3, title: 'Draft', type: 'SELF_EVALUATION', active: false, questionList: [] }
        ]);
        expect(fixture.componentInstance['rows']().map((row) => row.id)).toEqual([1, 3]);
        const toast = spyOn(fixture.componentInstance['toastService'], 'error');
        fixture.componentInstance['activate'](fixture.componentInstance['rows']()[1]);
        http.expectOne(`${FORMS_URL}/3/activate`).flush({ message: 'Ya existe una autoevaluación activa. Desactívela antes de activar otra.' }, { status: 400, statusText: 'Business rule' });
        expect(toast).toHaveBeenCalledWith('No se pudo activar', 'Ya existe una autoevaluación activa. Desactívela antes de activar otra.');
        expect(fixture.componentInstance['isBusy'](3)).toBeFalse();
    });

    it('permite reintentar cuando falla la carga del listado', () => {
        const element = open('self-evaluation');
        http.expectOne(FORMS_URL).flush({}, { status: 503, statusText: 'Unavailable' });
        fixture.detectChanges();
        expect(element.textContent).toContain('No se pudieron cargar los formularios');
        const retry = Array.from(element.querySelectorAll('button')).find((button) => button.textContent?.includes('Reintentar'))!;
        retry.click();
        http.expectOne(FORMS_URL).flush([]);
    });

    it('abre autoevaluaciones en la ruta principal y mantiene la precedencia de rutas', () => {
        expect(formsRoutes.find((route) => route.path === '')?.data?.['section']).toBe('self-evaluation');
        const paths = formsRoutes.map((route) => route.path);
        for (const path of ['self-evaluation', 'personalized', 'personalized/new']) {
            expect(paths.indexOf(path)).toBeLessThan(paths.indexOf(':id'));
        }
        expect(formsRoutes.find((route) => route.path === 'personalized/new')?.data?.['category']).toBe('personalized');
    });
});
