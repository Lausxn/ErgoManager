import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';

import { environment } from '../../../../environments/environment';
import { FormDetailComponent } from './form-detail.component';

const FORMS_URL = `${environment.apiUrl}/forms`;

describe('Form editor categories', () => {
    let fixture: ComponentFixture<FormDetailComponent>;
    let http: HttpTestingController;

    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [FormDetailComponent],
            providers: [provideRouter([]), provideNoopAnimations(), provideHttpClient(), provideHttpClientTesting()]
        });
        http = TestBed.inject(HttpTestingController);
        fixture = TestBed.createComponent(FormDetailComponent);
    });

    afterEach(() => http.verify());

    it('keeps weighted questions and sends the existing self evaluation contract', () => {
        fixture.detectChanges();
        const form = fixture.componentInstance['formDetail'];
        form.controls.title.setValue('Autoevaluación');
        form.controls.questionList.at(0).patchValue({ statement: '¿Puede apoyar la espalda?', weight: 2 });
        fixture.detectChanges();
        const element: HTMLElement = fixture.nativeElement;
        expect(element.textContent).toContain('Puntaje máximo');
        expect(element.querySelector('.form-summary__score-value')?.textContent?.trim()).toBe('6');
        element.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        const request = http.expectOne(FORMS_URL);
        expect(request.request.method).toBe('POST');
        expect(JSON.parse(request.request.serializeBody() as string).questionList).toEqual([{ statement: '¿Puede apoyar la espalda?', questionOrder: 1, weight: 2 }]);
        request.flush({}, { status: 400, statusText: 'Validation' });
    });

    it('prepares personalized questions without offering weights or sending a self evaluation request', () => {
        fixture.componentRef.setInput('category', 'personalized');
        fixture.detectChanges();
        const element: HTMLElement = fixture.nativeElement;
        expect(element.textContent).toContain('las preguntas no se guardarán al salir');
        expect(element.querySelector('[id="weight-0"]')).toBeNull();
        expect(element.querySelector('.form-summary__score')).toBeNull();
        const save = Array.from(element.querySelectorAll('button')).find((button) => button.textContent?.includes('Guardar formulario personalizado'))!;
        expect(save.disabled).toBeTrue();
        element.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        http.expectNone(FORMS_URL);
    });
});
