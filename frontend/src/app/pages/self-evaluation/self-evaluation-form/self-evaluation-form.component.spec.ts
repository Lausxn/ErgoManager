import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';

import { environment } from '../../../../environments/environment';
import { SelfEvaluationFormComponent } from './self-evaluation-form.component';

const FORMS_URL = `${environment.apiUrl}/forms`;
const SELF_EVALUATIONS_URL = `${environment.apiUrl}/self-evaluations`;

describe('Autoevaluación pública', () => {
    let fixture: ComponentFixture<SelfEvaluationFormComponent>;
    let http: HttpTestingController;

    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [SelfEvaluationFormComponent],
            providers: [provideNoopAnimations(), provideHttpClient(), provideHttpClientTesting()]
        });

        http = TestBed.inject(HttpTestingController);
        fixture = TestBed.createComponent(SelfEvaluationFormComponent);
    });

    afterEach(() => http.verify());

    function loadForm(): void {
        fixture.componentRef.setInput('companyId', 15);
        fixture.detectChanges();

        const request = http.expectOne(`${FORMS_URL}/active`);

        expect(request.request.method).toBe('GET');

        request.flush([
            {
                id: 7,
                title: 'Autoevaluación ergonómica',
                description: 'Formulario de prueba',
                publicationYear: 2026,
                type: 'SELF_EVALUATION',
                active: true,
                createdAt: '2026-10-20T10:00:00',
                questionList: [
                    {
                        id: 101,
                        statement: '¿Mantiene una postura adecuada?',
                        questionOrder: 1,
                        active: true,
                        optionList: [
                            {
                                id: 1003,
                                label: 'Frecuentemente',
                                optionOrder: 3
                            },
                            {
                                id: 1001,
                                label: 'Nunca',
                                optionOrder: 1
                            },
                            {
                                id: 1002,
                                label: 'A veces',
                                optionOrder: 2
                            }
                        ]
                    },
                    {
                        id: 102,
                        statement: '¿Realiza pausas activas?',
                        questionOrder: 2,
                        active: true,
                        optionList: [
                            {
                                id: 2002,
                                label: 'Siempre',
                                optionOrder: 2
                            },
                            {
                                id: 2001,
                                label: 'Nunca',
                                optionOrder: 1
                            }
                        ]
                    }
                ]
            }
        ]);

        fixture.detectChanges();
    }

    it('muestra las respuestas configuradas por el backend en el orden definido', () => {
        loadForm();

        const component = fixture.componentInstance;
        const questions = component['questionList']();

        expect(questions.length).toBe(2);

        expect(questions[0].optionList?.map((option) => option.id)).toEqual([1001, 1002, 1003]);

        expect(questions[0].optionList?.map((option) => option.label)).toEqual(['Nunca', 'A veces', 'Frecuentemente']);

        const element: HTMLElement = fixture.nativeElement;

        expect(element.textContent).toContain('Nunca');
        expect(element.textContent).toContain('A veces');
        expect(element.textContent).toContain('Frecuentemente');
        expect(element.textContent).toContain('Siempre');
    });

    it('envía questionId y optionId sin enviar selectedOption ni score', () => {
        loadForm();

        const component = fixture.componentInstance;
        const form = component['employeeForm'];

        form.patchValue({
            employeeName: '  Ana Pérez  ',
            employeeEmail: 'ANA@EMPRESA.COM',
            employeePosition: '  Analista  '
        });

        component['answerList'].at(0).setValue(1002);
        component['answerList'].at(1).setValue(2002);

        component['submit']();

        const request = http.expectOne(SELF_EVALUATIONS_URL);

        expect(request.request.method).toBe('POST');

        const body = request.request.body;

        expect(body).toEqual({
            formId: 7,
            companyId: 15,
            employeeName: 'Ana Pérez',
            employeeEmail: 'ana@empresa.com',
            employeePosition: 'Analista',
            answerList: [
                {
                    questionId: 101,
                    optionId: 1002
                },
                {
                    questionId: 102,
                    optionId: 2002
                }
            ]
        });

        expect(body.answerList[0].selectedOption).toBeUndefined();
        expect(body.answerList[0].score).toBeUndefined();

        request.flush({
            id: 90,
            formId: 7,
            companyId: 15,
            employeeName: 'Ana Pérez',
            employeeEmail: 'ana@empresa.com',
            employeePosition: 'Analista',
            totalScore: 4,
            averageScore: 2,
            riskPercentage: 50,
            riskLevel: 'MEDIUM',
            submittedAt: '2026-10-20T12:00:00',
            answerList: [
                {
                    id: 301,
                    questionId: 101,
                    statement: '¿Mantiene una postura adecuada?',
                    optionId: 1002,
                    selectedOption: 'A veces',
                    score: 1
                },
                {
                    id: 302,
                    questionId: 102,
                    statement: '¿Realiza pausas activas?',
                    optionId: 2002,
                    selectedOption: 'Siempre',
                    score: 3
                }
            ]
        });

        fixture.detectChanges();

        expect(component['result']()?.riskLevel).toBe('MEDIUM');
        expect(component['result']()?.riskPercentage).toBe(50);
    });

    it('muestra el nivel y porcentaje de riesgo devueltos por el backend', () => {
        loadForm();

        const component = fixture.componentInstance;
        const form = component['employeeForm'];

        form.patchValue({
            employeeName: 'Ana Pérez',
            employeeEmail: 'ana@empresa.com'
        });

        component['answerList'].at(0).setValue(1003);
        component['answerList'].at(1).setValue(2002);

        component['submit']();

        http.expectOne(SELF_EVALUATIONS_URL).flush({
            id: 91,
            formId: 7,
            companyId: 15,
            employeeName: 'Ana Pérez',
            employeeEmail: 'ana@empresa.com',
            totalScore: 5,
            averageScore: 2.5,
            riskPercentage: 75,
            riskLevel: 'HIGH',
            submittedAt: '2026-10-20T12:00:00',
            answerList: []
        });

        fixture.detectChanges();

        const element: HTMLElement = fixture.nativeElement;

        expect(element.textContent).toContain('Alto');
        expect(element.textContent).toContain('75 %');
        expect(element.textContent).toContain('Nivel de riesgo Alto');
    });

    it('no envía la autoevaluación mientras falte una respuesta obligatoria', () => {
        loadForm();

        const component = fixture.componentInstance;
        const form = component['employeeForm'];

        form.patchValue({
            employeeName: 'Ana Pérez',
            employeeEmail: 'ana@empresa.com'
        });

        component['answerList'].at(0).setValue(1001);

        component['submit']();

        http.expectNone(SELF_EVALUATIONS_URL);

        expect(component['errorMessage']()).toContain('1 pregunta');
        expect(form.invalid).toBeTrue();
    });
});
