import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { Router, provideRouter } from '@angular/router';

import { environment } from '../../../../environments/environment';
import { CompanyResponse } from '../../../shared/models/company.model';
import { CompanyFormComponent } from './company-form.component';

const COMPANIES_URL = `${environment.apiUrl}/companies`;

const COMPANY_URL = `${COMPANIES_URL}/7`;

/** Company stored in the backend, opened for editing. */
const STORED_COMPANY: CompanyResponse = {
    id: 7,
    businessName: 'Comercial Norte',
    taxId: '3-101-000010',
    contactEmail: 'rrhh@norte.test',
    phoneNumber: '2222-3333',
    address: 'Heredia',
    active: true,
    createdAt: '2026-10-01T10:00:00'
};

/** Every registered company: the one being edited, another active one and an inactive one. */
const REGISTERED_COMPANIES: CompanyResponse[] = [STORED_COMPANY, { ...STORED_COMPANY, id: 8, businessName: 'Industrias del Valle', taxId: '3-101-000009' }, { ...STORED_COMPANY, id: 9, businessName: 'Café Sol', taxId: '3-101-000011', active: false }];

describe('CompanyFormComponent (HU-020 validaciones de edición)', () => {
    let fixture: ComponentFixture<CompanyFormComponent>;
    let element: HTMLElement;
    let httpTesting: HttpTestingController;

    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [CompanyFormComponent],
            providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), provideNoopAnimations()]
        });
        httpTesting = TestBed.inject(HttpTestingController);
        spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
        open(STORED_COMPANY);
    });

    afterEach(() => httpTesting.verify());

    /**
     * Opens the form to edit a company, answering the requests it makes on start.
     *
     * @param stored company stored in the backend
     */
    function open(stored: CompanyResponse): void {
        fixture = TestBed.createComponent(CompanyFormComponent);
        fixture.componentRef.setInput('id', stored.id);
        fixture.detectChanges();
        httpTesting.expectOne({ method: 'GET', url: COMPANIES_URL }).flush(REGISTERED_COMPANIES.map((company) => (company.id === stored.id ? stored : company)));
        httpTesting.expectOne({ method: 'GET', url: `${COMPANIES_URL}/${stored.id}` }).flush(stored);
        fixture.detectChanges();
        element = fixture.nativeElement;
    }

    /**
     * Answers the save with HTTP 409 and then the list the form reads again to
     * find the taken field.
     *
     * @param message   explanation sent by the backend
     * @param companies companies registered at that moment
     */
    function rejectAsDuplicate(message: string, companies: CompanyResponse[]): void {
        httpTesting.expectOne({ method: 'PUT', url: COMPANY_URL }).flush({ status: 409, message }, { status: 409, statusText: 'Conflict' });
        httpTesting.expectOne({ method: 'GET', url: COMPANIES_URL }).flush(companies);
        fixture.detectChanges();
    }

    /**
     * Types a value in a field, as the user would.
     *
     * @param id    id of the input
     * @param value text typed
     */
    function type(id: string, value: string): void {
        const input = element.querySelector<HTMLInputElement>(`#${id}`)!;
        input.value = value;
        input.dispatchEvent(new Event('input'));
        input.dispatchEvent(new Event('blur'));
        fixture.detectChanges();
    }

    /** Sends the form. */
    function submit(): void {
        element.querySelector('form')!.dispatchEvent(new Event('submit'));
        fixture.detectChanges();
    }

    /**
     * Reads the message shown under a field.
     *
     * @param id id of the input
     * @returns text of the error, empty when there is none
     */
    function errorOf(id: string): string {
        return element.querySelector(`#${id}-error`)?.textContent?.trim() ?? '';
    }

    /** Text of the general alert above the actions. */
    function alertText(): string {
        return element.querySelector('.mgs-alert')?.textContent?.trim() ?? '';
    }

    it('carga los datos guardados de la empresa en los campos', () => {
        expect(element.querySelector<HTMLInputElement>('#businessName')!.value).toBe('Comercial Norte');
        expect(element.querySelector<HTMLInputElement>('#taxId')!.value).toBe('3-101-000010');
    });

    it('no guarda con campos vacíos y explica cuáles debe corregir', () => {
        type('businessName', '   ');
        type('contactEmail', '');
        submit();

        httpTesting.expectNone({ method: 'PUT', url: COMPANY_URL });
        expect(errorOf('businessName')).toBe('Este campo es obligatorio.');
        expect(errorOf('contactEmail')).toBe('Este campo es obligatorio.');
        expect(alertText()).toBe('Revise los campos marcados antes de guardar: Razón social y Correo de contacto.');
    });

    it('explica el formato esperado de la razón social, la cédula jurídica y el teléfono', () => {
        type('businessName', '---');
        type('taxId', '3-101-ABC');
        type('phoneNumber', '123');
        submit();

        httpTesting.expectNone({ method: 'PUT', url: COMPANY_URL });
        expect(errorOf('businessName')).toBe('La razón social debe incluir letras o números.');
        expect(errorOf('taxId')).toBe('Escriba la cédula jurídica con el formato 3-101-123456.');
        expect(errorOf('phoneNumber')).toBe('Escriba un teléfono válido de 8 a 15 dígitos, por ejemplo 2222-3333.');
        expect(alertText()).toBe('Revise los campos marcados antes de guardar: Razón social, Cédula jurídica y Teléfono.');
    });

    it('no permite la razón social de otra empresa, sin importar mayúsculas ni espacios', () => {
        for (const name of ['Industrias del Valle', 'INDUSTRIAS  DEL   VALLE', ' industrias del valle ']) {
            type('businessName', name);
            expect(errorOf('businessName')).withContext(name).toBe('Ya existe una empresa con esa razón social.');
        }
        // An inactive company keeps its name reserved.
        type('businessName', 'CAFÉ  sol');
        expect(errorOf('businessName')).toBe('Ya existe una empresa con esa razón social.');

        submit();
        httpTesting.expectNone({ method: 'PUT', url: COMPANY_URL });
        expect(alertText()).toBe('Revise los campos marcados antes de guardar: Razón social.');
    });

    it('considera distinta una razón social que solo cambia las tildes, igual que el backend', () => {
        type('businessName', 'Cafe Sol');
        expect(errorOf('businessName')).toBe('');
        type('businessName', 'Industrías del Valle');
        expect(errorOf('businessName')).toBe('');
    });

    it('permite conservar su propia razón social y envía los datos limpios', () => {
        type('businessName', '  COMERCIAL   norte ');
        expect(errorOf('businessName')).toBe('');
        submit();

        const request = httpTesting.expectOne({ method: 'PUT', url: COMPANY_URL });
        expect(request.request.body.businessName).toBe('COMERCIAL norte');
        request.flush({ ...STORED_COMPANY, businessName: 'COMERCIAL norte' });
    });

    it('agrega los guiones de la cédula jurídica mientras se escribe y solo acepta números', () => {
        const input = element.querySelector<HTMLInputElement>('#taxId')!;
        for (const [typed, shown] of [
            ['3', '3'],
            ['3101', '3-101'],
            ['31016', '3-101-6'],
            ['3101600001', '3-101-600001'],
            ['3 101-600001', '3-101-600001'],
            ['3-101-60000199', '3-101-600001'],
            ['3a1b0c1', '3-101']
        ]) {
            type('taxId', typed);
            expect(input.value).withContext(typed).toBe(shown);
        }
        type('taxId', '3101600001');
        submit();
        const request = httpTesting.expectOne({ method: 'PUT', url: COMPANY_URL });
        expect(request.request.body.taxId).toBe('3-101-600001');
        request.flush(STORED_COMPANY);
    });

    it('no permite la cédula jurídica de otra empresa mientras se escribe', () => {
        type('taxId', '3101000009');
        expect(errorOf('taxId')).toBe('Ya existe una empresa con esa cédula jurídica.');
        // An inactive company keeps its tax id reserved too.
        type('taxId', '3-101-000011');
        expect(errorOf('taxId')).toBe('Ya existe una empresa con esa cédula jurídica.');

        submit();
        httpTesting.expectNone({ method: 'PUT', url: COMPANY_URL });
        expect(alertText()).toBe('Revise los campos marcados antes de guardar: Cédula jurídica.');
    });

    it('marca la cédula jurídica cuando el servidor rechaza una registrada después de abrir el formulario', () => {
        type('taxId', '3-101-000020');
        submit();

        const message = 'Ya existe una empresa con esa cédula jurídica.';
        const registeredLater = { ...STORED_COMPANY, id: 10, businessName: 'Distribuidora Central', taxId: '3101000020' };
        rejectAsDuplicate(message, [...REGISTERED_COMPANIES, registeredLater]);

        expect(errorOf('taxId')).toBe(message);
        expect(errorOf('businessName')).toBe('');
        expect(alertText()).toBe(message);
    });

    it('marca la razón social, y no la cédula, cuando el servidor rechaza un nombre registrado después de abrir el formulario', () => {
        type('businessName', 'Distribuidora Central');
        submit();

        const message = 'Ya existe una empresa con ese nombre.';
        const registeredLater = { ...STORED_COMPANY, id: 10, businessName: 'Distribuidora Central', taxId: '3-101-000021' };
        rejectAsDuplicate(message, [...REGISTERED_COMPANIES, registeredLater]);

        expect(errorOf('businessName')).toBe('Ya existe una empresa con esa razón social.');
        expect(errorOf('taxId')).toBe('');
        expect(alertText()).toBe(message);
    });

    it('muestra solo el mensaje del servidor cuando no puede saber qué campo está repetido', () => {
        type('businessName', 'Nombre Nuevo');
        submit();

        const message = 'Ya existe un perfil de cliente con ese nombre.';
        rejectAsDuplicate(message, REGISTERED_COMPANIES);

        expect(errorOf('businessName')).toBe('');
        expect(errorOf('taxId')).toBe('');
        expect(alertText()).toBe(message);
    });

    it('actualiza la alerta mientras el usuario corrige los campos', () => {
        type('businessName', '---');
        type('taxId', '3-101-ABC');
        type('phoneNumber', '123');
        submit();
        expect(alertText()).toBe('Revise los campos marcados antes de guardar: Razón social, Cédula jurídica y Teléfono.');

        type('taxId', '3-101-000010');
        type('phoneNumber', '2222-3333');
        expect(alertText()).toBe('Revise los campos marcados antes de guardar: Razón social.');

        type('businessName', 'Comercial Norte');
        expect(alertText()).toBe('');
    });

    it('permite guardar una empresa registrada con formatos anteriores mientras no cambie esos campos', () => {
        open({ ...STORED_COMPANY, taxId: '3101ABC', phoneNumber: '123' });
        type('address', 'Alajuela');
        submit();

        const request = httpTesting.expectOne({ method: 'PUT', url: COMPANY_URL });
        expect(request.request.body.taxId).toBe('3101ABC');
        request.flush(STORED_COMPANY);

        type('phoneNumber', '1234');
        expect(errorOf('phoneNumber')).toBe('Escriba un teléfono válido de 8 a 15 dígitos, por ejemplo 2222-3333.');
    });

    it('muestra bajo cada campo los errores de validación que devuelve el servidor', () => {
        type('address', 'San José');
        submit();

        httpTesting.expectOne({ method: 'PUT', url: COMPANY_URL }).flush({ status: 400, message: 'Revise los datos ingresados.', fieldErrors: { contactEmail: 'Escriba un correo válido.' } }, { status: 400, statusText: 'Bad Request' });
        fixture.detectChanges();

        expect(errorOf('contactEmail')).toBe('Escriba un correo válido.');
        expect(alertText()).toBe('Revise los datos ingresados.');
    });
});
