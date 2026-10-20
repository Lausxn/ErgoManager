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

    function ready(personalized = false) {
        if (personalized) fixture.componentRef.setInput('category', 'personalized');
        fixture.detectChanges();
        const form = fixture.componentInstance['formDetail'];
        form.controls.title.setValue('Instrumento de prueba');
        form.controls.questionList.at(0).controls.statement.setValue('Pregunta inicial');
        if (!personalized) form.controls.questionList.at(0).controls.optionList.at(0).controls.label.setValue('Respuesta inicial');
        return form;
    }
    function submit() {
        fixture.componentInstance['submit']();
    }

    it('sends the type and option weights, with UI quantities and question weight excluded', () => {
        const form = ready();
        fixture.componentInstance['resizeQuestions'](2);
        fixture.componentInstance['resizeOptions'](0, 3);
        form.controls.questionList.at(1).controls.statement.setValue('Segunda pregunta');
        form.controls.questionList.at(1).controls.optionList.at(0).controls.label.setValue('Otra respuesta');
        const options = form.controls.questionList.at(0).controls.optionList;
        options.controls.forEach((option, index) => option.patchValue({ label: `Respuesta ${index + 1}`, weight: index + 1 }));
        submit();
        const request = http.expectOne(FORMS_URL);
        const body = JSON.parse(request.request.serializeBody() as string);
        expect(body.type).toBe('SELF_EVALUATION');
        expect(body.active).toBeUndefined();
        expect(body.questionCount).toBeUndefined();
        expect(body.questionList.length).toBe(2);
        expect(body.questionList[0].weight).toBeUndefined();
        expect(body.questionList[0].optionList.map((option: { weight: number }) => option.weight)).toEqual([1, 2, 3]);
        request.flush({}, { status: 400, statusText: 'Validation' });
    });

    it('creates personalized statements without predefined responses or weights', () => {
        ready(true);
        fixture.detectChanges();
        const element: HTMLElement = fixture.nativeElement;
        expect(element.querySelector('[id="weight-0-0"]')).toBeNull();
        expect(element.querySelector('[id="option-0-0"]')).toBeNull();
        expect(element.textContent).not.toContain('todavía no está disponible');
        submit();
        const request = http.expectOne(FORMS_URL);
        const body = JSON.parse(request.request.serializeBody() as string);
        expect(body.type).toBe('PERSONALIZED_EVALUATION');
        expect(body.questionList).toEqual([{ statement: 'Pregunta inicial', questionOrder: 1 }]);
        request.flush({}, { status: 400, statusText: 'Validation' });
    });

    it('switches creation type without letting hidden response validators block personalized forms', () => {
        const form = ready();
        form.controls.questionList.at(0).controls.optionList.at(0).controls.label.setValue('');
        expect(form.invalid).toBeTrue();
        form.controls.type.setValue('PERSONALIZED_EVALUATION');
        expect(form.valid).toBeTrue();
        form.controls.type.setValue('SELF_EVALUATION');
        expect(form.invalid).toBeTrue();
    });

    it('enforces question/option quantity boundaries and preserves existing entries when resizing', () => {
        const form = ready();
        const original = form.controls.questionList.at(0);
        fixture.componentInstance['resizeQuestions'](100);
        expect(form.controls.questionList.length).toBe(100);
        fixture.componentInstance['addQuestion']();
        expect(form.controls.questionList.length).toBe(100);
        for (const invalid of [0, 101, 1.5]) fixture.componentInstance['resizeQuestions'](invalid);
        expect(form.controls.questionList.length).toBe(100);
        fixture.componentInstance['resizeQuestions'](2);
        expect(form.controls.questionList.at(0)).toBe(original);
        fixture.componentInstance['resizeOptions'](0, 10);
        for (const invalid of [0, 11, 1.5]) fixture.componentInstance['resizeOptions'](0, invalid);
        expect(original.controls.optionList.length).toBe(10);
        fixture.componentInstance['resizeOptions'](0, 1);
        expect(original.controls.optionList.at(0).controls.label.value).toBe('Respuesta inicial');
    });

    it('rejects duplicate response labels regardless of case and surrounding spaces', () => {
        const form = ready();
        fixture.componentInstance['resizeOptions'](0, 2);
        const options = form.controls.questionList.at(0).controls.optionList;
        options.at(1).controls.label.setValue(' RESPUESTA INICIAL ');
        expect(options.hasError('duplicate')).toBeTrue();
        submit();
        http.expectNone(FORMS_URL);
        options.at(1).controls.label.setValue('Respuesta distinta');
        expect(options.hasError('duplicate')).toBeFalse();
    });

    for (const weight of [0, 4, 1.5, null]) {
        it(`rejects invalid response weight ${weight}`, () => {
            const form = ready();
            form.controls.questionList.at(0).controls.optionList.at(0).controls.weight.setValue(weight);
            submit();
            http.expectNone(FORMS_URL);
            expect(form.invalid).toBeTrue();
        });
    }

    it('places nested backend errors on the relevant option and shows its message', () => {
        const form = ready();
        submit();
        http.expectOne(FORMS_URL).flush({ message: 'Datos inválidos', fieldErrors: { 'questionList[0].optionList[0].weight': 'El peso máximo es 3.' } }, { status: 400, statusText: 'Validation' });
        fixture.detectChanges();
        const weight = form.controls.questionList.at(0).controls.optionList.at(0).controls.weight;
        expect(weight.getError('server')).toBe('El peso máximo es 3.');
        expect(weight.touched).toBeTrue();
        expect(fixture.nativeElement.textContent).toContain('El peso máximo es 3.');
    });

    it('preserves stored question/option IDs on PUT and locks the type', () => {
        fixture.componentRef.setInput('id', 7);
        fixture.detectChanges();
        http.expectOne(`${FORMS_URL}/7`).flush({
            id: 7,
            title: 'Existente',
            publicationYear: 2026,
            type: 'SELF_EVALUATION',
            active: false,
            questionList: [{ id: 10, statement: 'Original', questionOrder: 1, optionList: [{ id: 20, label: 'Respuesta', weight: 2, optionOrder: 1 }] }]
        });
        fixture.detectChanges();
        const form = fixture.componentInstance['formDetail'];
        expect(form.controls.type.disabled).toBeTrue();
        form.controls.title.setValue('Editado');
        submit();
        const request = http.expectOne(`${FORMS_URL}/7`);
        expect(request.request.method).toBe('PUT');
        expect(request.request.body.questionList[0].id).toBe(10);
        expect(request.request.body.questionList[0].optionList[0].id).toBe(20);
        expect(request.request.body.type).toBe('SELF_EVALUATION');
        request.flush({}, { status: 400, statusText: 'Validation' });
    });

    it('loads personalized forms when optional description and option lists are absent', () => {
        fixture.componentRef.setInput('id', 8);
        fixture.detectChanges();
        http.expectOne(`${FORMS_URL}/8`).flush({ id: 8, title: 'Personalizado', publicationYear: 2026, type: 'PERSONALIZED_EVALUATION', active: false, questionList: [{ id: 11, statement: 'Observación', questionOrder: 1 }] });
        fixture.detectChanges();
        expect(fixture.componentInstance['formDetail'].valid).toBeTrue();
        expect(fixture.nativeElement.querySelector('[id="weight-0-0"]')).toBeNull();
        submit();
        const request = http.expectOne(`${FORMS_URL}/8`);
        const body = JSON.parse(request.request.serializeBody() as string);
        expect(body.description).toBeUndefined();
        expect(body.questionList).toEqual([{ id: 11, statement: 'Observación', questionOrder: 1 }]);
        request.flush({}, { status: 400, statusText: 'Validation' });
    });

    it('restores generated arrays and the original type when discarding changes', () => {
        ready(true);
        fixture.componentInstance['resizeQuestions'](3);
        fixture.componentInstance['formDetail'].controls.type.setValue('SELF_EVALUATION');
        fixture.componentInstance['unsaved'].discard();
        expect(fixture.componentInstance['questionList'].length).toBe(1);
        expect(fixture.componentInstance['formDetail'].controls.type.value).toBe('PERSONALIZED_EVALUATION');
        expect(fixture.componentInstance['questionList'].at(0).controls.optionList.disabled).toBeTrue();
    });
});
