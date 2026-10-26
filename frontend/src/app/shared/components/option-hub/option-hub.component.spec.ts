import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { HubOption, OptionHubComponent } from './option-hub.component';

const OPTIONS: HubOption[] = [
    { title: 'Agenda', description: 'Consulte las citas.', icon: 'fa-regular fa-calendar-days', route: '/appointments/agenda' },
    { title: 'Disponibilidad', description: 'Publique los espacios.', icon: 'fa-regular fa-calendar-plus', route: '/appointments/availabilities' }
];

describe('OptionHubComponent', () => {
    let fixture: ComponentFixture<OptionHubComponent>;
    let element: HTMLElement;

    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [OptionHubComponent],
            providers: [provideRouter([])]
        });
        fixture = TestBed.createComponent(OptionHubComponent);
        fixture.componentRef.setInput('heading', 'Citas');
        fixture.componentRef.setInput('options', OPTIONS);
        fixture.detectChanges();
        element = fixture.nativeElement;
    });

    function cards(): HTMLAnchorElement[] {
        return Array.from(element.querySelectorAll<HTMLAnchorElement>('a.mgs-option'));
    }

    it('muestra el título de la sección y una línea breve debajo', () => {
        expect(element.querySelector('h1')?.textContent?.trim()).toBe('Citas');
        expect(element.querySelector('.mgs-subtitle')?.textContent?.trim()).toBe('Elija qué desea gestionar.');
    });

    it('muestra una tarjeta cuadrada por opción, con su título y su descripción', () => {
        expect(cards().map((card) => card.querySelector('.mgs-option__title')?.textContent?.trim())).toEqual(['Agenda', 'Disponibilidad']);
        expect(cards().map((card) => card.querySelector('.mgs-option__description')?.textContent?.trim())).toEqual(['Consulte las citas.', 'Publique los espacios.']);
        expect(cards().every((card) => card.classList.contains('mgs-option--tile'))).toBeTrue();
    });

    it('lleva cada tarjeta a su pantalla', () => {
        expect(cards().map((card) => card.getAttribute('href'))).toEqual(['/appointments/agenda', '/appointments/availabilities']);
    });

    it('mantiene la línea por defecto cuando la ruta no envía una', () => {
        fixture.componentRef.setInput('lead', undefined);
        fixture.detectChanges();
        expect(element.querySelector('.mgs-subtitle')?.textContent?.trim()).toBe('Elija qué desea gestionar.');
    });

    it('ocupa el alto libre de la página para centrar las tarjetas', () => {
        expect(element.classList).toContain('mgs-option-stage');
    });
});
