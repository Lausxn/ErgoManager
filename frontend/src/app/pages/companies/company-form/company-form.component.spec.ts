import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { Router, provideRouter } from '@angular/router';

import { environment } from '../../../../environments/environment';
import { CompanyResponse } from '../../../shared/models/company.model';
import { ToastService } from '../../../shared/services/toast.service';
import { CompanyFormComponent } from './company-form.component';

const COMPANIES_URL = `${environment.apiUrl}/companies`;
const DUPLICATED_NAME = 'Ya existe una empresa con ese nombre.';
const DUPLICATED_TAX_ID = 'Ya existe una empresa con esa cédula jurídica.';

const STORED: CompanyResponse = {
    id: 7,
    businessName: 'Servicios del Valle S.A.',
    taxId: '3-101-800080',
    contactEmail: 'rrhh@valle.test',
    phoneNumber: '2222-3333',
    address: 'Heredia',
    active: true,
    createdAt: '2026-10-01T10:00:00'
};

describe('CompanyFormComponent', () => {
    let fixture: ComponentFixture<CompanyFormComponent>;
    let http: HttpTestingController;
    let toast: jasmine.SpyObj<ToastService>;
    let navigate: jasmine.Spy;

    /** Opens the form: to create a profile, or to edit the given company. */
    function open(id?: number): void {
        toast = jasmine.createSpyObj<ToastService>('ToastService', ['success', 'error', 'info']);
        TestBed.configureTestingModule({
            imports: [CompanyFormComponent],
            providers: [provideRouter([]), provideNoopAnimations(), provideHttpClient(), provideHttpClientTesting(), { provide: ToastService, useValue: toast }]
        });
        http = TestBed.inject(HttpTestingController);
        navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
        fixture = TestBed.createComponent(CompanyFormComponent);
        if (id !== undefined) {
            fixture.componentRef.setInput('id', id);
        }
        fixture.detectChanges();
    }

    function page(): HTMLElement {
        return fixture.nativeElement as HTMLElement;
    }

    /** Types a value in a field, as the user would. */
    function type(id: string, value: string): void {
        const input = page().querySelector<HTMLInputElement>(`#${id}`)!;
        input.value = value;
        input.dispatchEvent(new Event('input'));
        input.dispatchEvent(new Event('blur'));
        fixture.detectChanges();
    }

    function clickButton(label: string): void {
        const button = Array.from(page().querySelectorAll('button')).find((element) => element.textContent?.trim() === label);
        expect(button).withContext(`botón "${label}"`).toBeDefined();
        button!.click();
        fixture.detectChanges();
    }

    /** Message shown under a field, empty when it has none. */
    function errorOf(id: string): string {
        return page().querySelector(`#${id}-error`)?.textContent?.trim() ?? '';
    }

    function alertText(): string {
        return page().querySelector('.mgs-alert[role="alert"]')?.textContent?.trim() ?? '';
    }

    /** Fills the required fields of a new profile and sends it. */
    function fillAndCreate(): void {
        type('businessName', '  Servicios del Valle S.A. ');
        type('taxId', ' 3-101-800080 ');
        type('contactEmail', ' RRHH@Valle.TEST ');
        clickButton('Crear perfil');
    }

    afterEach(() => http.verify());

    describe('crear perfil', () => {
        it('envía POST /api/companies con los datos limpios y vuelve al listado', () => {
            open();
            fillAndCreate();

            const request = http.expectOne({ method: 'POST', url: COMPANIES_URL });
            expect(request.request.body).toEqual({ businessName: 'Servicios del Valle S.A.', taxId: '3-101-800080', contactEmail: 'rrhh@valle.test', phoneNumber: undefined, address: undefined });
            request.flush({ ...STORED, phoneNumber: undefined, address: undefined });

            expect(toast.success).toHaveBeenCalledWith('Perfil creado', 'Servicios del Valle S.A.');
            expect(navigate).toHaveBeenCalledWith(['/companies']);
        });

        it('envía los datos opcionales cuando se escriben', () => {
            open();
            type('phoneNumber', ' 2222-3333 ');
            type('address', ' Heredia ');
            fillAndCreate();

            const request = http.expectOne({ method: 'POST', url: COMPANIES_URL });
            expect(request.request.body.phoneNumber).toBe('2222-3333');
            expect(request.request.body.address).toBe('Heredia');
            request.flush(STORED);
        });

        it('no llama al backend si faltan datos obligatorios', () => {
            open();
            type('businessName', 'Servicios del Valle S.A.');
            clickButton('Crear perfil');

            http.expectNone({ method: 'POST', url: COMPANIES_URL });
            expect(alertText()).toContain('Revise los campos marcados antes de guardar.');
            expect(errorOf('taxId')).not.toBe('');
            expect(errorOf('contactEmail')).not.toBe('');
        });
    });

    describe('valores repetidos (HTTP 409)', () => {
        it('marca la razón social cuando el backend avisa que el nombre ya existe', () => {
            open();
            fillAndCreate();

            http.expectOne({ method: 'POST', url: COMPANIES_URL }).flush({ status: 409, message: DUPLICATED_NAME }, { status: 409, statusText: 'Conflict' });
            fixture.detectChanges();

            expect(errorOf('businessName')).toBe(DUPLICATED_NAME);
            expect(errorOf('taxId')).toBe('');
            expect(alertText()).toContain(DUPLICATED_NAME);
            expect(navigate).not.toHaveBeenCalled();
            // The typed values stay, so the user only fixes the name.
            expect(page().querySelector<HTMLInputElement>('#taxId')!.value).toBe(' 3-101-800080 ');
        });

        it('marca la cédula jurídica cuando el backend avisa que ya existe', () => {
            open();
            fillAndCreate();

            http.expectOne({ method: 'POST', url: COMPANIES_URL }).flush({ status: 409, message: DUPLICATED_TAX_ID }, { status: 409, statusText: 'Conflict' });
            fixture.detectChanges();

            expect(errorOf('taxId')).toBe(DUPLICATED_TAX_ID);
            expect(errorOf('businessName')).toBe('');
            expect(alertText()).toContain(DUPLICATED_TAX_ID);
        });

        it('sin explicación del backend no marca ningún campo y lo indica en el aviso', () => {
            open();
            fillAndCreate();

            http.expectOne({ method: 'POST', url: COMPANIES_URL }).flush(null, { status: 409, statusText: 'Conflict' });
            fixture.detectChanges();

            expect(errorOf('businessName')).toBe('');
            expect(errorOf('taxId')).toBe('');
            expect(alertText()).toContain('Ya existe otra empresa con esos datos.');
        });

        it('el error de nombre repetido se quita al corregir el nombre', () => {
            open();
            fillAndCreate();
            http.expectOne({ method: 'POST', url: COMPANIES_URL }).flush({ status: 409, message: DUPLICATED_NAME }, { status: 409, statusText: 'Conflict' });
            fixture.detectChanges();

            type('businessName', 'Servicios del Valle Norte S.A.');

            expect(errorOf('businessName')).toBe('');
        });
    });

    it('muestra bajo cada campo los errores de validación del backend (HTTP 400)', () => {
        open();
        fillAndCreate();

        http.expectOne({ method: 'POST', url: COMPANIES_URL }).flush(
            { status: 400, message: 'Revise los datos ingresados.', fieldErrors: { contactEmail: 'Escriba un correo válido.', taxId: 'Use un máximo de 20 caracteres.' } },
            { status: 400, statusText: 'Bad Request' }
        );
        fixture.detectChanges();

        expect(errorOf('contactEmail')).toBe('Escriba un correo válido.');
        expect(errorOf('taxId')).toBe('Use un máximo de 20 caracteres.');
        expect(alertText()).toContain('Revise los datos ingresados.');
    });

    describe('editar perfil', () => {
        it('carga la empresa con GET /api/companies/{id} y guarda con PUT', () => {
            open(STORED.id);
            http.expectOne({ method: 'GET', url: `${COMPANIES_URL}/${STORED.id}` }).flush(STORED);
            fixture.detectChanges();
            expect(page().querySelector<HTMLInputElement>('#businessName')!.value).toBe(STORED.businessName);

            type('address', 'Alajuela');
            clickButton('Guardar cambios');

            const request = http.expectOne({ method: 'PUT', url: `${COMPANIES_URL}/${STORED.id}` });
            expect(request.request.body).toEqual({ businessName: STORED.businessName, taxId: STORED.taxId, contactEmail: STORED.contactEmail, phoneNumber: STORED.phoneNumber, address: 'Alajuela' });
            request.flush({ ...STORED, address: 'Alajuela' });

            expect(toast.success).toHaveBeenCalledWith('Empresa actualizada', STORED.businessName);
            expect(navigate).toHaveBeenCalledWith(['/companies']);
        });

        it('al renombrar con un nombre que ya existe, marca la razón social', () => {
            open(STORED.id);
            http.expectOne({ method: 'GET', url: `${COMPANIES_URL}/${STORED.id}` }).flush(STORED);
            fixture.detectChanges();

            type('businessName', 'Café Sol');
            clickButton('Guardar cambios');
            http.expectOne({ method: 'PUT', url: `${COMPANIES_URL}/${STORED.id}` }).flush({ status: 409, message: DUPLICATED_NAME }, { status: 409, statusText: 'Conflict' });
            fixture.detectChanges();

            expect(errorOf('businessName')).toBe(DUPLICATED_NAME);
            expect(errorOf('taxId')).toBe('');
        });
    });
});
