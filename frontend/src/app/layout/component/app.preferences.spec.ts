import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LayoutService, PREFERENCES_STORAGE_KEY } from '../service/layout.service';
import { AppPreferencesComponent } from './app.preferences';

describe('AppPreferencesComponent', () => {
    let fixture: ComponentFixture<AppPreferencesComponent>;
    let element: HTMLElement;
    let layoutService: LayoutService;

    /** Finds an element inside the component. */
    function find<T extends HTMLElement>(selector: string): T | null {
        return element.querySelector<T>(selector);
    }

    /** Clicks an element and refreshes the view. */
    function click(selector: string): void {
        find(selector)!.click();
        fixture.detectChanges();
    }

    beforeEach(() => {
        localStorage.removeItem(PREFERENCES_STORAGE_KEY);
        TestBed.configureTestingModule({ imports: [AppPreferencesComponent] });
        layoutService = TestBed.inject(LayoutService);
        layoutService.setDarkTheme(false);
        layoutService.setPageSize('normal');
        fixture = TestBed.createComponent(AppPreferencesComponent);
        element = fixture.nativeElement;
        document.body.append(element);
        fixture.detectChanges();
    });

    afterEach(() => {
        element.remove();
        document.documentElement.classList.remove('app-dark');
        document.documentElement.style.fontSize = '';
        localStorage.removeItem(PREFERENCES_STORAGE_KEY);
    });

    it('muestra solo el botón hasta que el usuario abre el panel', () => {
        expect(find('.mgs-prefs__panel')).toBeNull();
        click('.mgs-prefs__trigger');
        expect(find('.mgs-prefs__panel')).not.toBeNull();
        expect(find('.mgs-prefs__trigger')!.getAttribute('aria-expanded')).toBe('true');
    });

    it('cambia el tamaño de texto con el deslizante y lo muestra como porcentaje', () => {
        click('.mgs-prefs__trigger');
        const range = find<HTMLInputElement>('#mgs-prefs-size')!;
        expect(range.value).toBe('1');
        expect(find('.mgs-prefs__percent')!.textContent).toContain('100 %');
        expect(find<HTMLButtonElement>('.mgs-prefs__reset')!.disabled).toBeTrue();
        range.value = '2';
        range.dispatchEvent(new Event('input'));
        fixture.detectChanges();
        expect(layoutService.pageSize()).toBe('large');
        expect(find('.mgs-prefs__percent')!.textContent).toContain('113 %');
        expect(find('.mgs-prefs__tick--active')!.textContent).toContain('113 %');
        click('.mgs-prefs__reset');
        expect(layoutService.pageSize()).toBe('normal');
        expect(range.value).toBe('1');
    });

    it('activa el modo oscuro desde el interruptor sin cerrar el panel', () => {
        click('.mgs-prefs__trigger');
        click('.mgs-prefs__switch');
        expect(layoutService.isDarkTheme()).toBeTrue();
        expect(find('.mgs-prefs__switch')!.getAttribute('aria-checked')).toBe('true');
        expect(find('.mgs-prefs__mode-state')!.textContent).toContain('Activado');
        expect(find('.mgs-prefs__panel')).not.toBeNull();
    });

    it('se cierra al hacer clic afuera o al presionar Escape', () => {
        click('.mgs-prefs__trigger');
        document.body.click();
        fixture.detectChanges();
        expect(find('.mgs-prefs__panel')).toBeNull();
        click('.mgs-prefs__trigger');
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        fixture.detectChanges();
        expect(find('.mgs-prefs__panel')).toBeNull();
    });
});
