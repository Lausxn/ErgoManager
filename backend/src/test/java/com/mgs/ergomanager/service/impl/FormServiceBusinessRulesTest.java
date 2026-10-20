package com.mgs.ergomanager.service.impl;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.mgs.ergomanager.dto.form.AnswerOptionRequestDTO;
import com.mgs.ergomanager.dto.form.FormRequestDTO;
import com.mgs.ergomanager.dto.form.QuestionRequestDTO;
import com.mgs.ergomanager.exception.BusinessException;
import com.mgs.ergomanager.model.AnswerOption;
import com.mgs.ergomanager.model.Form;
import com.mgs.ergomanager.model.Question;
import com.mgs.ergomanager.model.enums.FormType;
import com.mgs.ergomanager.repository.AnswerOptionRepository;
import com.mgs.ergomanager.repository.CompanyRepository;
import com.mgs.ergomanager.repository.FormRepository;
import com.mgs.ergomanager.repository.QuestionRepository;
import com.mgs.ergomanager.repository.SelfEvaluationRepository;
import com.mgs.ergomanager.service.EmailService;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/**
 * Unit tests for the business rules applied to form creation, activation and
 * deactivation.
 */
@ExtendWith(MockitoExtension.class)
class FormServiceBusinessRulesTest {

    private static final String ACTIVE_SELF_EVALUATION_EXISTS_MESSAGE =
            "Ya existe una autoevaluación activa. Desactívela antes de activar otra.";

    @Mock
    private FormRepository formRepository;

    @Mock
    private QuestionRepository questionRepository;

    @Mock
    private AnswerOptionRepository answerOptionRepository;

    @Mock
    private CompanyRepository companyRepository;

    @Mock
    private SelfEvaluationRepository selfEvaluationRepository;

    @Mock
    private EmailService emailService;

    private FormServiceImpl formService;

    /**
     * Creates the service under test with mocked collaborators.
     */
    @BeforeEach
    void setUp() {
        formService = new FormServiceImpl(
                formRepository,
                questionRepository,
                answerOptionRepository,
                companyRepository,
                selfEvaluationRepository,
                emailService,
                "http://localhost:4200");
    }

    /**
     * Verifies that a new form is saved as an inactive draft, even while another
     * form is active, so the active one keeps being answered.
     */
    @Test
    void createShouldSaveInactiveDraftEvenWhenAnotherFormIsActive() {
        FormRequestDTO request = buildRequest();

        when(formRepository.save(any(Form.class)))
                .thenAnswer(invocation -> {
                    Form form = invocation.getArgument(0);
                    form.setId(1L);
                    return form;
                });

        when(questionRepository.saveAll(any()))
                .thenAnswer(invocation -> invocation.getArgument(0));

        var response = formService.create(request);

        assertFalse(response.active());

        verify(formRepository, never())
                .findByActiveTrue();

        verify(formRepository)
                .save(any(Form.class));

        verify(questionRepository)
                .saveAll(any());
    }

    /**
     * Verifies that a complete form can be activated when there is no other
     * active form of its type.
     */
    @Test
    void activateShouldActivateFormWhenNoOtherActiveFormExists() {
        Form form = buildForm(1L, false, FormType.SELF_EVALUATION);
        Question question = buildQuestion(10L, form);

        when(formRepository.findById(1L))
                .thenReturn(Optional.of(form));

        when(formRepository.findByActiveTrue())
                .thenReturn(List.of());

        when(questionRepository
                .findByFormIdAndActiveTrueOrderByQuestionOrderAsc(1L))
                .thenReturn(List.of(question));

        when(answerOptionRepository
                .findByQuestionIdInAndActiveTrueOrderByOptionOrderAsc(anyCollection()))
                .thenReturn(List.of(buildOption(20L, question)));

        var response = formService.activate(1L);

        assertTrue(form.isActive());
        assertTrue(response.active());

        verify(formRepository).save(form);
    }

    /**
     * Verifies that a form cannot be activated while another active form of
     * the same type already exists.
     */
    @Test
    void activateShouldRejectWhenAnotherActiveFormOfTheSameTypeExists() {
        Form form = buildForm(1L, false, FormType.SELF_EVALUATION);

        when(formRepository.findById(1L))
                .thenReturn(Optional.of(form));

        when(formRepository.findByActiveTrue())
                .thenReturn(List.of(buildForm(2L, true, FormType.SELF_EVALUATION)));

        BusinessException exception = assertThrows(
                BusinessException.class,
                () -> formService.activate(1L));

        assertEquals(
                ACTIVE_SELF_EVALUATION_EXISTS_MESSAGE,
                exception.getMessage());

        assertFalse(form.isActive());

        verify(formRepository, never())
                .save(form);
    }

    /**
     * Verifies that an active form of the other type does not block the
     * activation: a self evaluation and a personalized evaluation can be active
     * at the same time.
     */
    @Test
    void activateShouldAllowWhenOnlyAFormOfTheOtherTypeIsActive() {
        Form form = buildForm(1L, false, FormType.PERSONALIZED_EVALUATION);

        when(formRepository.findById(1L))
                .thenReturn(Optional.of(form));

        when(formRepository.findByActiveTrue())
                .thenReturn(List.of(buildForm(2L, true, FormType.SELF_EVALUATION)));

        when(questionRepository
                .findByFormIdAndActiveTrueOrderByQuestionOrderAsc(1L))
                .thenReturn(List.of(buildQuestion(10L, form)));

        var response = formService.activate(1L);

        assertTrue(response.active());

        verify(formRepository).save(form);
    }

    /**
     * Verifies that a self evaluation whose questions have no predefined
     * answers cannot be activated.
     */
    @Test
    void activateShouldRejectSelfEvaluationWithoutPredefinedAnswers() {
        Form form = buildForm(1L, false, FormType.SELF_EVALUATION);

        when(formRepository.findById(1L))
                .thenReturn(Optional.of(form));

        when(formRepository.findByActiveTrue())
                .thenReturn(List.of());

        when(questionRepository
                .findByFormIdAndActiveTrueOrderByQuestionOrderAsc(1L))
                .thenReturn(List.of(buildQuestion(10L, form)));

        BusinessException exception = assertThrows(
                BusinessException.class,
                () -> formService.activate(1L));

        assertEquals(
                "La pregunta 1 no tiene respuestas predefinidas. Agréguelas antes de activar el formulario.",
                exception.getMessage());

        assertFalse(form.isActive());
    }

    /**
     * Verifies that activating a form that is already active is idempotent and
     * does not attempt to save it again.
     */
    @Test
    void activateShouldKeepAlreadyActiveFormUnchanged() {
        Form form = buildForm(1L, true, FormType.SELF_EVALUATION);

        when(formRepository.findById(1L))
                .thenReturn(Optional.of(form));

        when(questionRepository
                .findByFormIdAndActiveTrueOrderByQuestionOrderAsc(1L))
                .thenReturn(List.of());

        var response = formService.activate(1L);

        assertTrue(response.active());

        verify(formRepository, never())
                .findByActiveTrue();

        verify(formRepository, never())
                .save(form);
    }

    /**
     * Verifies that deactivation only changes the active flag and keeps the form
     * stored instead of deleting it.
     */
    @Test
    void deactivateShouldKeepFormStoredAndMarkItInactive() {
        Form form = buildForm(1L, true, FormType.SELF_EVALUATION);

        when(formRepository.findById(1L))
                .thenReturn(Optional.of(form));

        formService.deactivate(1L);

        assertFalse(form.isActive());

        verify(formRepository)
                .save(form);

        verify(formRepository, never())
                .delete(any(Form.class));

        verify(formRepository, never())
                .deleteById(1L);
    }

    /**
     * Creates a valid request used by creation tests.
     *
     * @return valid form request
     */
    private static FormRequestDTO buildRequest() {
        QuestionRequestDTO question =
                new QuestionRequestDTO(
                        null,
                        "¿Cómo se siente en su puesto de trabajo?",
                        1,
                        List.of(new AnswerOptionRequestDTO(null, "Bien", 1, 1)));

        return new FormRequestDTO(
                "Formulario ergonómico",
                "Formulario de autoevaluación",
                2026,
                FormType.SELF_EVALUATION,
                List.of(question));
    }

    /**
     * Creates a form with the requested state and type.
     *
     * @param id     identifier of the form
     * @param active current active state
     * @param type   type of the form
     * @return form configured for the test
     */
    private static Form buildForm(
            Long id,
            boolean active,
            FormType type) {

        Form form = new Form();

        form.setId(id);
        form.setTitle("Formulario ergonómico");
        form.setDescription("Formulario de autoevaluación");
        form.setPublicationYear(2026);
        form.setType(type);
        form.setActive(active);

        return form;
    }

    /**
     * Creates the first active question of a form.
     *
     * @param id   identifier of the question
     * @param form owner form
     * @return question configured for the test
     */
    private static Question buildQuestion(
            Long id,
            Form form) {

        Question question = new Question();

        question.setId(id);
        question.setForm(form);
        question.setStatement("¿Cómo se siente en su puesto de trabajo?");
        question.setQuestionOrder(1);

        return question;
    }

    /**
     * Creates a predefined answer of a question.
     *
     * @param id       identifier of the option
     * @param question owner question
     * @return option configured for the test
     */
    private static AnswerOption buildOption(
            Long id,
            Question question) {

        AnswerOption option = new AnswerOption();

        option.setId(id);
        option.setQuestion(question);
        option.setLabel("Bien");
        option.setWeight(1);
        option.setOptionOrder(1);

        return option;
    }
}
