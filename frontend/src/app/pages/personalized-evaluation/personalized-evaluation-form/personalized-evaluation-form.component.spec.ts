import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';

import { environment } from '../../../../environments/environment';
import { AuthService } from '../../../core/services/auth.service';
import { PersonalizedEvaluationFormComponent } from './personalized-evaluation-form.component';

const FORMS_URL = `${environment.apiUrl}/forms`;
const APPOINTMENTS_URL = `${environment.apiUrl}/appointments`;
const PERSONALIZED_EVALUATIONS_URL = `${environment.apiUrl}/personalized-evaluations`;

describe('Evaluación personalizada', () => {
    let fixture: ComponentFixture<PersonalizedEvaluationFormComponent>;
    let http: HttpTestingController;

    const authServiceMock = {
        session: () => ({
            userId: 8
        })
    };

    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [PersonalizedEvaluationFormComponent],
            providers: [
                provideRouter([]),
                provideNoopAnimations(),
                provideHttpClient(),
                provideHttpClientTesting(),
                {
                    provide: AuthService,
                    useValue: authServiceMock
                }
            ]
        });

        http = TestBed.inject(HttpTestingController);
        fixture = TestBed.createComponent(PersonalizedEvaluationFormComponent);
    });

    afterEach(() => http.verify());

    function loadScreen(): void {
        fixture.detectChanges();

        const formRequest = http.expectOne(`${FORMS_URL}/personalized/active`);

        expect(formRequest.request.method).toBe('GET');

        formRequest.flush({
            id: 12,
            title: 'Evaluación ergonómica personalizada',
            description: 'Formulario utilizado durante la evaluación presencial.',
            publicationYear: 2026,
            type: 'PERSONALIZED_EVALUATION',
            active: true,
            createdAt: '2026-10-20T09:00:00',
            questionList: [
                {
                    id: 202,
                    statement: 'Revise la posición de la pantalla.',
                    questionOrder: 2,
                    active: true
                },
                {
                    id: 201,
                    statement: 'Revise la postura de la persona.',
                    questionOrder: 1,
                    active: true
                }
            ]
        });

        const appointmentsRequest = http.expectOne((request) => {
            return request.url === APPOINTMENTS_URL && request.params.get('userId') === '8';
        });

        expect(appointmentsRequest.request.method).toBe('GET');

        appointmentsRequest.flush([
            {
                id: 44,
                selfEvaluationId: 31,
                userId: 8,
                employeeName: 'Carlos Ramírez',
                startDateTime: '2026-10-20T10:00:00',
                endDateTime: '2026-10-20T11:00:00',
                status: 'COMPLETED',
                employeeEmail: 'carlos@empresa.com',
                companyId: 5,
                companyName: 'Empresa Demo',
                ergonomistName: 'Ergonomista Demo',
                evaluated: false
            }
        ]);

        const evaluationsRequest = http.expectOne((request) => {
            return request.url === PERSONALIZED_EVALUATIONS_URL && request.params.get('userId') === '8';
        });

        expect(evaluationsRequest.request.method).toBe('GET');

        evaluationsRequest.flush([]);

        fixture.detectChanges();
    }

    it('obtiene el formulario personalizado activo y ordena sus preguntas', () => {
        loadScreen();

        const component = fixture.componentInstance;
        const questions = component['questionList']();

        expect(component['activeForm']()?.id).toBe(12);
        expect(questions.map((question) => question.id)).toEqual([201, 202]);

        const element: HTMLElement = fixture.nativeElement;

        expect(element.textContent).toContain('Revise la postura de la persona.');
        expect(element.textContent).toContain('Revise la posición de la pantalla.');
    });

    it('crea un diagnóstico y una recomendación obligatorios por pregunta', () => {
        loadScreen();

        const component = fixture.componentInstance;
        const answers = component['answerList'];

        expect(answers.length).toBe(2);

        expect(answers.at(0).controls.questionId.value).toBe(201);
        expect(answers.at(1).controls.questionId.value).toBe(202);

        expect(answers.at(0).controls.diagnosis.hasError('required')).toBeTrue();
        expect(answers.at(0).controls.recommendation.hasError('required')).toBeTrue();

        answers.at(0).controls.diagnosis.setValue('a'.repeat(1001));
        answers.at(0).controls.recommendation.setValue('b'.repeat(1001));

        expect(answers.at(0).controls.diagnosis.hasError('maxlength')).toBeTrue();
        expect(answers.at(0).controls.recommendation.hasError('maxlength')).toBeTrue();
    });

    it('envía appointmentId, formId y una respuesta por pregunta sin riesgo ni campos generales', () => {
        loadScreen();

        const component = fixture.componentInstance;
        const form = component['evaluationForm'];
        const answers = component['answerList'];

        form.controls.appointmentId.setValue(44);

        answers.at(0).controls.diagnosis.setValue('  Postura inclinada hacia adelante.  ');
        answers.at(0).controls.recommendation.setValue('  Ajustar la altura de la silla.  ');

        answers.at(1).controls.diagnosis.setValue('  Pantalla ubicada por debajo de la línea visual.  ');
        answers.at(1).controls.recommendation.setValue('  Elevar la pantalla hasta la altura adecuada.  ');

        component['submit']();

        const request = http.expectOne(PERSONALIZED_EVALUATIONS_URL);

        expect(request.request.method).toBe('POST');

        const body = request.request.body;

        expect(body).toEqual({
            appointmentId: 44,
            formId: 12,
            answerList: [
                {
                    questionId: 201,
                    diagnosis: 'Postura inclinada hacia adelante.',
                    recommendation: 'Ajustar la altura de la silla.'
                },
                {
                    questionId: 202,
                    diagnosis: 'Pantalla ubicada por debajo de la línea visual.',
                    recommendation: 'Elevar la pantalla hasta la altura adecuada.'
                }
            ]
        });

        expect(body.riskLevel).toBeUndefined();
        expect(body.diagnosis).toBeUndefined();
        expect(body.recommendations).toBeUndefined();

        request.flush({
            id: 77,
            appointmentId: 44,
            userId: 8,
            employeeName: 'Carlos Ramírez',
            formId: 12,
            formTitle: 'Evaluación ergonómica personalizada',
            reportPath: '/reports/personalized-77.pdf',
            evaluatedAt: '2026-10-20T15:00:00',
            employeeEmail: 'carlos@empresa.com',
            companyName: 'Empresa Demo',
            answerList: [
                {
                    id: 501,
                    questionId: 201,
                    questionOrder: 1,
                    statement: 'Revise la postura de la persona.',
                    diagnosis: 'Postura inclinada hacia adelante.',
                    recommendation: 'Ajustar la altura de la silla.'
                },
                {
                    id: 502,
                    questionId: 202,
                    questionOrder: 2,
                    statement: 'Revise la posición de la pantalla.',
                    diagnosis: 'Pantalla ubicada por debajo de la línea visual.',
                    recommendation: 'Elevar la pantalla hasta la altura adecuada.'
                }
            ]
        });

        fixture.detectChanges();

        expect(component['savedEvaluation']()?.id).toBe(77);
        expect(component['savedEvaluation']()?.answerList.length).toBe(2);
    });

    it('muestra statement, diagnosis y recommendation después de guardar', () => {
        loadScreen();

        const component = fixture.componentInstance;
        const form = component['evaluationForm'];
        const answers = component['answerList'];

        form.controls.appointmentId.setValue(44);

        answers.at(0).controls.diagnosis.setValue('Postura inadecuada.');
        answers.at(0).controls.recommendation.setValue('Corregir posición.');

        answers.at(1).controls.diagnosis.setValue('Pantalla baja.');
        answers.at(1).controls.recommendation.setValue('Elevar monitor.');

        component['submit']();

        http.expectOne(PERSONALIZED_EVALUATIONS_URL).flush({
            id: 78,
            appointmentId: 44,
            userId: 8,
            employeeName: 'Carlos Ramírez',
            formId: 12,
            formTitle: 'Evaluación ergonómica personalizada',
            evaluatedAt: '2026-10-20T15:00:00',
            employeeEmail: 'carlos@empresa.com',
            companyName: 'Empresa Demo',
            answerList: [
                {
                    id: 601,
                    questionId: 201,
                    questionOrder: 1,
                    statement: 'Revise la postura de la persona.',
                    diagnosis: 'Postura inadecuada.',
                    recommendation: 'Corregir posición.'
                },
                {
                    id: 602,
                    questionId: 202,
                    questionOrder: 2,
                    statement: 'Revise la posición de la pantalla.',
                    diagnosis: 'Pantalla baja.',
                    recommendation: 'Elevar monitor.'
                }
            ]
        });

        fixture.detectChanges();

        const element: HTMLElement = fixture.nativeElement;

        expect(element.textContent).toContain('Revise la postura de la persona.');
        expect(element.textContent).toContain('Postura inadecuada.');
        expect(element.textContent).toContain('Corregir posición.');
        expect(element.textContent).toContain('Revise la posición de la pantalla.');
        expect(element.textContent).toContain('Pantalla baja.');
        expect(element.textContent).toContain('Elevar monitor.');
    });

    it('no envía la evaluación si falta el diagnóstico o la recomendación de una pregunta', () => {
        loadScreen();

        const component = fixture.componentInstance;
        const form = component['evaluationForm'];
        const answers = component['answerList'];

        form.controls.appointmentId.setValue(44);

        answers.at(0).controls.diagnosis.setValue('Postura inadecuada.');
        answers.at(0).controls.recommendation.setValue('Corregir posición.');

        answers.at(1).controls.diagnosis.setValue('Pantalla baja.');

        component['submit']();

        http.expectNone(PERSONALIZED_EVALUATIONS_URL);

        expect(form.invalid).toBeTrue();
        expect(component['errorMessage']()).toBe('Revise los campos marcados antes de guardar.');
    });
});
