import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';

import { PASSWORD_REMINDER_AUTO_HIDE_MS, PasswordUpdatePopupComponent } from './password-update-popup.component';

describe('PasswordUpdatePopupComponent', () => {
    let fixture: ComponentFixture<PasswordUpdatePopupComponent>;
    let element: HTMLElement;
    let closed: number;
    let updateRequested: number;

    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [PasswordUpdatePopupComponent],
            providers: [provideNoopAnimations()]
        });
        fixture = TestBed.createComponent(PasswordUpdatePopupComponent);
        element = fixture.nativeElement;
        closed = 0;
        updateRequested = 0;
        fixture.componentInstance.closed.subscribe(() => closed++);
        fixture.componentInstance.updateRequested.subscribe(() => updateRequested++);
    });

    /** Shows or hides the reminder, as the layout does. */
    function show(visible: boolean): void {
        fixture.componentRef.setInput('visible', visible);
        fixture.detectChanges();
    }

    function card(): HTMLElement | null {
        return element.querySelector('.password-reminder');
    }

    function buttonByText(text: string): HTMLButtonElement {
        const button = Array.from(element.querySelectorAll('button')).find((candidate) => candidate.textContent?.trim() === text);
        expect(button).withContext(`botón "${text}"`).toBeDefined();
        return button!;
    }

    it('no muestra nada mientras no deba recordarse el cambio', () => {
        show(false);
        expect(card()).toBeNull();
    });

    it('muestra un aviso breve, sin bloquear la página', fakeAsync(() => {
        show(true);

        expect(card()!.textContent).toContain('Su contraseña es temporal');
        expect(card()!.textContent).toContain('Cámbiela para proteger su cuenta.');
        expect(element.querySelector('.p-dialog-mask, .p-overlay-mask')).toBeNull();
        show(false);
    }));

    it('avisa al layout cuando la persona elige cambiar la contraseña', fakeAsync(() => {
        show(true);
        buttonByText('Cambiar contraseña').click();

        expect(updateRequested).toBe(1);
        expect(closed).toBe(0);
        tick(PASSWORD_REMINDER_AUTO_HIDE_MS);
        expect(closed).withContext('el temporizador se detiene').toBe(0);
    }));

    it('se cierra con Ahora no, con la equis y con Escape', fakeAsync(() => {
        show(true);
        buttonByText('Ahora no').click();
        expect(closed).toBe(1);

        element.querySelector<HTMLButtonElement>('button[aria-label="Cerrar aviso"]')!.click();
        expect(closed).toBe(2);

        card()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        expect(closed).toBe(3);
        show(false);
    }));

    it('se oculta solo a los 15 segundos si la persona no interactúa', fakeAsync(() => {
        show(true);

        tick(PASSWORD_REMINDER_AUTO_HIDE_MS - 1);
        expect(closed).toBe(0);
        tick(1);
        expect(closed).toBe(1);
    }));

    it('se mantiene abierto mientras el puntero está encima y luego continúa la cuenta', fakeAsync(() => {
        show(true);
        tick(10000);
        card()!.dispatchEvent(new MouseEvent('mouseenter'));
        tick(60000);
        expect(closed).toBe(0);

        card()!.dispatchEvent(new MouseEvent('mouseleave'));
        tick(4999);
        expect(closed).toBe(0);
        tick(1);
        expect(closed).toBe(1);
    }));

    it('se mantiene abierto mientras el foco está dentro del aviso', fakeAsync(() => {
        show(true);
        const action = buttonByText('Ahora no');
        action.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
        tick(PASSWORD_REMINDER_AUTO_HIDE_MS * 2);
        expect(closed).toBe(0);

        action.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: document.body }));
        tick(PASSWORD_REMINDER_AUTO_HIDE_MS);
        expect(closed).toBe(1);
    }));

    it('reinicia la cuenta cada vez que vuelve a mostrarse', fakeAsync(() => {
        show(true);
        tick(10000);
        show(false);
        show(true);

        tick(10000);
        expect(closed).toBe(0);
        tick(5000);
        expect(closed).toBe(1);
    }));
});
