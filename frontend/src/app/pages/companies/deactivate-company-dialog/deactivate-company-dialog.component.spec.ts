import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';

import { environment } from '../../../../environments/environment';
import { CompanyResponse } from '../../../shared/models/company.model';
import { CompanyListComponent } from '../company-list/company-list.component';

const COMPANIES_URL = `${environment.apiUrl}/companies`;

/** Active company whose profile is deactivated in the tests. */
const COMPANY: CompanyResponse = {
    id: 4,
    businessName: 'Industrias del Valle',
    taxId: '3-101-000001',
    contactEmail: 'rrhh@valle.test',
    active: true,
    createdAt: '2026-10-01T10:00:00'
};

describe('DeactivateCompanyDialogComponent (HU-021 pop-up de desactivación)', () => {
    let fixture: ComponentFixture<CompanyListComponent>;
    let httpTesting: HttpTestingController;

    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [CompanyListComponent],
            providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), provideNoopAnimations()]
        });
        httpTesting = TestBed.inject(HttpTestingController);
        fixture = TestBed.createComponent(CompanyListComponent);
        fixture.detectChanges();
        httpTesting.expectOne({ method: 'GET', url: COMPANIES_URL }).flush([COMPANY]);
        fixture.detectChanges();
    });

    afterEach(() => httpTesting.verify());

    /** Pop-up shown on screen, or null when it is closed. */
    function dialog(): HTMLElement | null {
        return document.querySelector('.deactivate-company');
    }

    /** Clicks the deactivate action of the company row. */
    function openDialog(): void {
        fixture.nativeElement.querySelector('button[aria-label="Desactivar empresa"]').click();
        fixture.detectChanges();
    }

    /**
     * Clicks a button of the pop-up by its text.
     *
     * @param label text of the button
     */
    async function clickDialogButton(label: string): Promise<void> {
        const button = Array.from(dialog()!.querySelectorAll('button')).find((element) => element.textContent?.trim() === label);
        button!.click();
        await settle();
    }

    /** Waits until the pop-up finishes opening or closing, its content leaves the page after the animation. */
    async function settle(): Promise<void> {
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();
    }

    it('pregunta si está seguro de desactivar el perfil y muestra la empresa', () => {
        openDialog();

        expect(dialog()).not.toBeNull();
        expect(dialog()!.querySelector('h2')!.textContent!.trim()).toBe('¿Está seguro de desactivar este perfil?');
        expect(dialog()!.textContent).toContain('Industrias del Valle');
        expect(dialog()!.textContent).toContain('Cédula jurídica 3-101-000001');
        expect(dialog()!.textContent).toContain('Las evaluaciones y el historial se conservan');
    });

    it('no desactiva nada cuando el usuario cancela', async () => {
        openDialog();
        await clickDialogButton('Cancelar');

        httpTesting.expectNone({ method: 'DELETE', url: `${COMPANIES_URL}/4` });
        expect(dialog()).toBeNull();
    });

    it('desactiva la empresa cuando el usuario confirma y cierra el pop-up', async () => {
        openDialog();
        await clickDialogButton('Desactivar');

        httpTesting.expectOne({ method: 'DELETE', url: `${COMPANIES_URL}/4` }).flush(null, { status: 204, statusText: 'No Content' });
        await settle();

        expect(dialog()).toBeNull();
        expect(fixture.nativeElement.querySelector('button[aria-label="Reactivar empresa"]')).not.toBeNull();
    });
});
