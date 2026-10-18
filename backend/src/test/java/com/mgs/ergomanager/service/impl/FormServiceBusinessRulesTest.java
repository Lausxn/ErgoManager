package com.mgs.ergomanager.service.impl;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.mgs.ergomanager.dto.form.FormRequestDTO;
import com.mgs.ergomanager.dto.form.QuestionRequestDTO;
import com.mgs.ergomanager.exception.BusinessException;
import com.mgs.ergomanager.model.Form;
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
 * Unit tests for the business rules applied to form activation and
 * deactivation.
 */
@ExtendWith(MockitoExtension.class)
class FormServiceBusinessRulesTest {

    private static final String ACTIVE_FORM_EXISTS_MESSAGE =
            "Ya existe un formulario activo. Desactívelo antes de crear o activar otro formulario.";

    @Mock
    private FormRepository formRepository;

    @Mock
    private QuestionRepository questionRepository;

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
                companyRepository,
                selfEvaluationRepository,
                emailService,
                "http://localhost:4200");
    }

    /**
     * Verifies that a new active form cannot be created while another form is
     * already active.
     */
    @Test
    void createShouldRejectWhenAnotherActiveFormExists() {
        FormRequestDTO request = buildRequest();

        when(formRepository.existsByActiveTrue())
                .thenReturn(true);

        BusinessException exception = assertThrows(
                BusinessException.class,
                () -> formService.create(request));

        assertEquals(
                ACTIVE_FORM_EXISTS_MESSAGE,
                exception.getMessage());

        verify(formRepository, never())
                .save(any(Form.class));

        verify(questionRepository, never())
                .saveAll(any());
    }

    /**
     * Verifies that a new form is created as active when no other active form
     * exists.
     */
    @Test
    void createShouldSaveActiveFormWhenNoActiveFormExists() {
        FormRequestDTO request = buildRequest();

        when(formRepository.existsByActiveTrue())
                .thenReturn(false);

        when(formRepository.save(any(Form.class)))
                .thenAnswer(invocation -> {
                    Form form = invocation.getArgument(0);
                    form.setId(1L);
                    return form;
                });

        when(questionRepository.saveAll(any()))
                .thenAnswer(invocation -> invocation.getArgument(0));

        var response = formService.create(request);

        assertTrue(response.active());

        verify(formRepository)
                .save(any(Form.class));

        verify(questionRepository)
                .saveAll(any());
    }

    /**
     * Verifies that a deactivated form can be activated when there is no other
     * active form.
     */
    @Test
    void activateShouldActivateFormWhenNoOtherActiveFormExists() {
        Form form = buildForm(1L, false);

        when(formRepository.findById(1L))
                .thenReturn(Optional.of(form));

        when(formRepository.existsByActiveTrueAndIdNot(1L))
                .thenReturn(false);

        when(questionRepository
                .findByFormIdAndActiveTrueOrderByQuestionOrderAsc(1L))
                .thenReturn(List.of());

        var response = formService.activate(1L);

        assertTrue(form.isActive());
        assertTrue(response.active());

        verify(formRepository).save(form);
    }

    /**
     * Verifies that a form cannot be activated while another active form
     * already exists.
     */
    @Test
    void activateShouldRejectWhenAnotherActiveFormExists() {
        Form form = buildForm(1L, false);

        when(formRepository.findById(1L))
                .thenReturn(Optional.of(form));

        when(formRepository.existsByActiveTrueAndIdNot(1L))
                .thenReturn(true);

        BusinessException exception = assertThrows(
                BusinessException.class,
                () -> formService.activate(1L));

        assertEquals(
                ACTIVE_FORM_EXISTS_MESSAGE,
                exception.getMessage());

        assertFalse(form.isActive());

        verify(formRepository, never())
                .save(form);
    }

    /**
     * Verifies that activating a form that is already active is idempotent and
     * does not attempt to save it again.
     */
    @Test
    void activateShouldKeepAlreadyActiveFormUnchanged() {
        Form form = buildForm(1L, true);

        when(formRepository.findById(1L))
                .thenReturn(Optional.of(form));

        when(questionRepository
                .findByFormIdAndActiveTrueOrderByQuestionOrderAsc(1L))
                .thenReturn(List.of());

        var response = formService.activate(1L);

        assertTrue(response.active());

        verify(formRepository, never())
                .existsByActiveTrueAndIdNot(1L);

        verify(formRepository, never())
                .save(form);
    }

    /**
     * Verifies that deactivation only changes the active flag and keeps the form
     * stored instead of deleting it.
     */
    @Test
    void deactivateShouldKeepFormStoredAndMarkItInactive() {
        Form form = buildForm(1L, true);

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
                        1);

        return new FormRequestDTO(
                "Formulario ergonómico",
                "Formulario de autoevaluación",
                2026,
                List.of(question));
    }

    /**
     * Creates a form with the requested state.
     *
     * @param id     identifier of the form
     * @param active current active state
     * @return form configured for the test
     */
    private static Form buildForm(
            Long id,
            boolean active) {

        Form form = new Form();

        form.setId(id);
        form.setTitle("Formulario ergonómico");
        form.setDescription("Formulario de autoevaluación");
        form.setPublicationYear(2026);
        form.setActive(active);

        return form;
    }
}