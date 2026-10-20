import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { Router, provideRouter } from '@angular/router';

import { environment } from '../../../../environments/environment';
import { CompanyResponse } from '../../../shared/models/company.model';
import { ToastService } from '../../../shared/services/toast.service';
import { companiesRoutes } from '../companies.routes';
import { CompanyListComponent } from '../company-list/company-list.component';
import { CompanyFormComponent } from './company-form.component';

const URL = `${environment.apiUrl}/companies`;
const COMPANY: CompanyResponse = {
    id: 110,
    businessName: 'Cliente existente',
    taxId: '3-101-110001',
    contactEmail: 'contacto@example.test',
    phoneNumber: '2222-3333',
    address: 'San José',
    active: true,
    createdAt: '2026-10-01T10:00:00'
};

describe('Client profile editing interface', () => {
    let fixture: ComponentFixture<CompanyFormComponent>;
    let http: HttpTestingController;
    let navigate: jasmine.Spy;
    let toast: jasmine.SpyObj<ToastService>;

    beforeEach(() => {
        toast = jasmine.createSpyObj<ToastService>('ToastService', ['success', 'error']);
        TestBed.configureTestingModule({
            imports: [CompanyFormComponent, CompanyListComponent],
            providers: [provideRouter([]), provideNoopAnimations(), provideHttpClient(), provideHttpClientTesting(), { provide: ToastService, useValue: toast }]
        });
        http = TestBed.inject(HttpTestingController);
        navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    });

    afterEach(() => http.verify());

    function open(): HTMLElement {
        fixture = TestBed.createComponent(CompanyFormComponent);
        fixture.componentRef.setInput('id', COMPANY.id);
        fixture.detectChanges();
        return fixture.nativeElement;
    }

    function load(): HTMLElement {
        const element = open();
        http.expectOne(`${URL}/${COMPANY.id}`).flush(COMPANY);
        fixture.detectChanges();
        return element;
    }

    function type(id: string, value: string): void {
        const input = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>(`#${id}`)!;
        input.value = value;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        fixture.detectChanges();
    }

    function submit(): void {
        (fixture.nativeElement as HTMLElement).querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        fixture.detectChanges();
    }

    it('shows loading placeholders instead of editable blank values', () => {
        const element = open();
        expect(element.querySelector('form')?.getAttribute('aria-busy')).toBe('true');
        expect(element.querySelectorAll('p-skeleton').length).toBeGreaterThan(0);
        expect(element.querySelector('#businessName')).toBeNull();
        http.expectOne(`${URL}/${COMPANY.id}`).flush(COMPANY);
    });

    it('loads all five supported fields and identifies the editing flow', () => {
        const element = load();
        expect(element.querySelector('h1')?.textContent).toContain('Editar perfil de cliente');
        const expected = { businessName: COMPANY.businessName, taxId: COMPANY.taxId, contactEmail: COMPANY.contactEmail, phoneNumber: COMPANY.phoneNumber, address: COMPANY.address };
        for (const [id, value] of Object.entries(expected)) {
            expect(element.querySelector<HTMLInputElement>(`#${id}`)?.value).toBe(value);
        }
        expect(element.querySelector('form')?.getAttribute('aria-busy')).toBe('false');
        expect(element.querySelector('.mgs-save-bar')).toBeNull();
        expect(element.querySelector('aside')?.getAttribute('aria-label')).toBe('Vista previa del perfil');
        expect(element.querySelector('aside')?.textContent).toContain(COMPANY.businessName);
    });

    it('updates the preview and warns before leaving with unsaved changes', () => {
        const element = load();
        type('businessName', 'Cliente actualizado');
        expect(element.querySelector('aside')?.textContent).toContain('Cliente actualizado');
        expect(element.querySelector('.mgs-save-bar')?.textContent).toContain('Guardar cambios');
        expect(element.querySelector('.mgs-save-bar')?.textContent).toContain('Restablecer');
        expect(fixture.componentInstance.canLeave()).toBeFalse();
    });

    it('restores the loaded profile and preview rather than emptying the form', () => {
        const element = load();
        type('address', 'Heredia');
        Array.from(element.querySelectorAll('button'))
            .find((button) => button.textContent?.trim() === 'Restablecer')!
            .click();
        fixture.detectChanges();
        expect(element.querySelector<HTMLInputElement>('#address')?.value).toBe(COMPANY.address);
        expect(element.querySelector('aside')?.textContent).toContain(COMPANY.address!);
        expect(element.querySelector('.mgs-save-bar')).toBeNull();
        expect(fixture.componentInstance.canLeave()).toBeTrue();
    });

    it('uses PUT for saving and preserves the existing progress and success behavior', () => {
        const element = load();
        type('address', 'Heredia');
        submit();
        submit();
        const request = http.expectOne(`${URL}/${COMPANY.id}`);
        expect(request.request.method).toBe('PUT');
        expect(request.request.body.address).toBe('Heredia');
        expect(element.querySelector('form')?.getAttribute('aria-busy')).toBe('true');
        const restore = Array.from(element.querySelectorAll('button')).find((button) => button.textContent?.trim() === 'Restablecer')!;
        expect(restore.disabled).toBeTrue();
        http.expectNone((pending) => pending.method === 'POST');
        request.flush({ ...COMPANY, address: 'Heredia' });
        fixture.detectChanges();
        expect(toast.success).toHaveBeenCalledWith('Empresa actualizada', COMPANY.businessName);
        expect(navigate).toHaveBeenCalledWith(['/companies']);
        expect(fixture.componentInstance.canLeave()).toBeTrue();
    });

    it('retains entered values and the save bar when the update fails', () => {
        const element = load();
        type('address', 'Heredia');
        submit();
        http.expectOne(`${URL}/${COMPANY.id}`).flush({ message: 'No se pudo actualizar el perfil. Intente de nuevo.' }, { status: 500, statusText: 'Server error' });
        fixture.detectChanges();
        expect(element.querySelector('.mgs-alert[role="alert"]')?.textContent).toContain('No se pudo actualizar el perfil. Intente de nuevo.');
        expect(element.querySelector<HTMLInputElement>('#address')?.value).toBe('Heredia');
        expect(element.querySelector('.mgs-save-bar')).not.toBeNull();
        expect(element.querySelector('form')?.getAttribute('aria-busy')).toBe('false');
        expect(navigate).not.toHaveBeenCalled();
    });

    for (const status of [403, 404]) {
        it(`uses the existing toast and return navigation for an inaccessible profile (${status})`, () => {
            open();
            http.expectOne(`${URL}/${COMPANY.id}`).flush({}, { status, statusText: 'Unavailable' });
            expect(toast.error).toHaveBeenCalled();
            expect(navigate).toHaveBeenCalledWith(['/companies']);
        });
    }

    it('preserves the creation interface when no profile id is supplied', () => {
        fixture = TestBed.createComponent(CompanyFormComponent);
        fixture.detectChanges();
        expect((fixture.nativeElement as HTMLElement).querySelector('h1')?.textContent).toContain('Registro de empresa');
        expect((fixture.nativeElement as HTMLElement).querySelector('#businessName')).not.toBeNull();
        http.expectNone(URL);
    });

    it('exposes an accessible edit action from the existing list and route', () => {
        const list = TestBed.createComponent(CompanyListComponent);
        list.detectChanges();
        http.expectOne(URL).flush([COMPANY]);
        list.detectChanges();
        expect((list.nativeElement as HTMLElement).querySelector(`button[aria-label="Editar perfil de ${COMPANY.businessName}"]`)).not.toBeNull();
        expect(companiesRoutes.find((route) => route.path === ':id')?.component).toBe(CompanyFormComponent);
        expect(companiesRoutes.find((route) => route.path === ':id')?.canDeactivate?.length).toBeGreaterThan(0);
    });
});
