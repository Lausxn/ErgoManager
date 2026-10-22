package com.mgs.ergomanager.service.impl;

import com.mgs.ergomanager.dto.form.FormRequestDTO;
import com.mgs.ergomanager.dto.form.FormResendResponseDTO;
import com.mgs.ergomanager.dto.form.FormResponseDTO;
import com.mgs.ergomanager.dto.form.QuestionRequestDTO;
import com.mgs.ergomanager.dto.form.QuestionResponseDTO;
import com.mgs.ergomanager.exception.BusinessException;
import com.mgs.ergomanager.exception.ResourceNotFoundException;
import com.mgs.ergomanager.model.Company;
import com.mgs.ergomanager.model.Form;
import com.mgs.ergomanager.model.Question;
import com.mgs.ergomanager.repository.CompanyRepository;
import com.mgs.ergomanager.repository.FormRepository;
import com.mgs.ergomanager.repository.QuestionRepository;
import com.mgs.ergomanager.repository.SelfEvaluationRepository;
import com.mgs.ergomanager.service.EmailService;
import com.mgs.ergomanager.service.FormService;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Default implementation of {@link FormService}.
 */
@Service
public class FormServiceImpl implements FormService {

    private static final Logger LOGGER = LoggerFactory.getLogger(FormServiceImpl.class);
    private static final String FORM_NOT_FOUND_MESSAGE = "No se encontró el formulario.";
    private static final String COMPANY_NOT_FOUND_MESSAGE = "No se encontró la empresa.";

    private static final Comparator<Question> BY_ORDER =
            Comparator.comparing(Question::getQuestionOrder).thenComparing(Question::getId);

    private final FormRepository formRepository;
    private final QuestionRepository questionRepository;
    private final CompanyRepository companyRepository;
    private final SelfEvaluationRepository selfEvaluationRepository;
    private final EmailService emailService;
    private final String frontendUrl;

    /**
     * Builds the service with its collaborators.
     *
     * @param formRepository           repository of forms
     * @param questionRepository       repository of questions
     * @param companyRepository        repository of client companies
     * @param selfEvaluationRepository repository of self evaluations, source of the employee emails
     * @param emailService             service that sends the invitations
     * @param frontendUrl              base URL of the Angular application
     */
    public FormServiceImpl(FormRepository formRepository,
                           QuestionRepository questionRepository,
                           CompanyRepository companyRepository,
                           SelfEvaluationRepository selfEvaluationRepository,
                           EmailService emailService,
                           @Value("${ergomanager.frontend-url}") String frontendUrl) {
        this.formRepository = formRepository;
        this.questionRepository = questionRepository;
        this.companyRepository = companyRepository;
        this.selfEvaluationRepository = selfEvaluationRepository;
        this.emailService = emailService;
        this.frontendUrl = frontendUrl.endsWith("/") ? frontendUrl.substring(0, frontendUrl.length() - 1) : frontendUrl;
    }

    @Override
    @Transactional(readOnly = true)
    public List<FormResponseDTO> findAll() {
        return toResponses(formRepository.findAllByOrderByPublicationYearDescCreatedAtDescIdDesc());
    }

    @Override
    @Transactional(readOnly = true)
    public List<FormResponseDTO> findActive() {
        return toResponses(formRepository.findByActiveTrueOrderByPublicationYearDescCreatedAtDescIdDesc());
    }

    @Override
    @Transactional(readOnly = true)
    public FormResponseDTO findById(Long id) {
        Form form = getForm(id);
        return toResponse(form, questionRepository.findByFormIdAndActiveTrueOrderByQuestionOrderAsc(id));
    }

    @Override
    @Transactional
    public FormResponseDTO create(FormRequestDTO request) {
        Form form = new Form();
        copy(request, form);
        form.setActive(true);
        Form saved = formRepository.save(form);

        // A new form has no questions yet, so any question id sent is ignored.
        List<Question> questions = request.questionList().stream()
                .map(questionRequest -> newQuestion(saved, questionRequest))
                .toList();
        List<Question> savedQuestions = questionRepository.saveAll(questions);
        return toResponse(saved, activeSorted(savedQuestions));
    }

    @Override
    @Transactional
    public FormResponseDTO update(Long id, FormRequestDTO request) {
        Form form = getForm(id);
        copy(request, form);

        Map<Long, Question> existing = questionRepository.findByFormId(id).stream()
                .collect(Collectors.toMap(Question::getId, Function.identity()));
        Set<Long> kept = new HashSet<>();
        List<Question> toSave = new ArrayList<>();

        for (QuestionRequestDTO questionRequest : request.questionList()) {
            if (questionRequest.id() == null) {
                toSave.add(newQuestion(form, questionRequest));
                continue;
            }
            Question question = existing.get(questionRequest.id());
            if (question == null) {
                throw new BusinessException("La pregunta " + questionRequest.id() + " no pertenece a este formulario.");
            }
            if (!kept.add(question.getId())) {
                throw new BusinessException("La pregunta " + questionRequest.id() + " está repetida.");
            }
            question.setStatement(questionRequest.statement());
            question.setQuestionOrder(questionRequest.questionOrder());
            question.setWeight(questionRequest.weight());
            question.setActive(true);
            toSave.add(question);
        }

        // Questions left out are only hidden: stored answers still reference them.
        for (Question question : existing.values()) {
            if (question.isActive() && !kept.contains(question.getId())) {
                question.setActive(false);
                toSave.add(question);
            }
        }

        formRepository.save(form);
        List<Question> saved = questionRepository.saveAll(toSave);
        return toResponse(form, activeSorted(saved));
    }

    @Override
    @Transactional
    public void deactivate(Long id) {
        Form form = getForm(id);
        form.setActive(false);
        formRepository.save(form);
    }

    @Override
    @Transactional
    public FormResponseDTO activate(Long id) {
        Form form = getForm(id);
        form.setActive(true);
        formRepository.save(form);
        return toResponse(form, questionRepository.findByFormIdAndActiveTrueOrderByQuestionOrderAsc(id));
    }

    /**
     * Sends the invitation to the contact of the company and to every employee
     * that already answered a self evaluation for it. It runs without a
     * transaction on purpose, so no database connection is held while the
     * emails are sent. A failed recipient is logged and does not stop the rest.
     *
     * @param formId    identifier of the form to resend
     * @param companyId identifier of the company to notify
     * @return number of emails sent successfully
     */
    @Override
    public FormResendResponseDTO resendAnnually(Long formId, Long companyId) {
        Form form = getForm(formId);
        Company company = companyRepository.findById(companyId)
                .orElseThrow(() -> new ResourceNotFoundException(COMPANY_NOT_FOUND_MESSAGE));
        if (!form.isActive()) {
            throw new BusinessException("El formulario está inactivo. Actívelo antes de reenviarlo.");
        }
        if (!company.isActive()) {
            throw new BusinessException("La empresa está inactiva. Actívela antes de reenviar el formulario.");
        }

        Set<String> recipients = new LinkedHashSet<>();
        recipients.add(company.getContactEmail().trim().toLowerCase(Locale.ROOT));
        for (String email : selfEvaluationRepository.findDistinctEmployeeEmailsByCompanyId(companyId)) {
            recipients.add(email.trim().toLowerCase(Locale.ROOT));
        }

        String link = frontendUrl + "/self-evaluation?companyId=" + companyId;
        int sent = 0;
        for (String recipient : recipients) {
            try {
                emailService.sendFormInvitation(recipient, company.getBusinessName(), form.getTitle(), link);
                sent++;
            } catch (Exception exception) {
                LOGGER.error("No se pudo enviar el formulario {} al destinatario {}", formId, recipient, exception);
            }
        }
        LOGGER.info("Formulario {} reenviado a la empresa {}: {} de {} correos enviados",
                formId, companyId, sent, recipients.size());
        return new FormResendResponseDTO(sent);
    }

    /**
     * Reads a form or fails with HTTP 404.
     *
     * @param id identifier of the form
     * @return the stored form
     */
    private Form getForm(Long id) {
        return formRepository.findById(id).orElseThrow(() -> new ResourceNotFoundException(FORM_NOT_FOUND_MESSAGE));
    }

    /**
     * Copies the already normalized request over a form.
     *
     * @param request data sent by the client
     * @param form    entity to fill
     */
    private static void copy(FormRequestDTO request, Form form) {
        form.setTitle(request.title());
        form.setDescription(request.description());
        form.setPublicationYear(request.publicationYear());
    }

    /**
     * Builds a new active question for a form.
     *
     * @param form    owner form
     * @param request data of the question
     * @return unsaved question
     */
    private static Question newQuestion(Form form, QuestionRequestDTO request) {
        Question question = new Question();
        question.setForm(form);
        question.setStatement(request.statement());
        question.setQuestionOrder(request.questionOrder());
        question.setWeight(request.weight());
        question.setActive(true);
        return question;
    }

    /**
     * Keeps the active questions and orders them for display.
     *
     * @param questions questions of a form
     * @return ordered active questions
     */
    private static List<Question> activeSorted(List<Question> questions) {
        return questions.stream().filter(Question::isActive).sorted(BY_ORDER).toList();
    }

    /**
     * Maps a list of forms, reading all their active questions in one query.
     *
     * @param forms forms to map
     * @return form responses in the same order
     */
    private List<FormResponseDTO> toResponses(List<Form> forms) {
        if (forms.isEmpty()) {
            return List.of();
        }
        Map<Long, List<Question>> questionsByForm = questionRepository
                .findByFormIdInAndActiveTrueOrderByQuestionOrderAsc(forms.stream().map(Form::getId).toList())
                .stream()
                .collect(Collectors.groupingBy(question -> question.getForm().getId()));
        return forms.stream()
                .map(form -> toResponse(form, questionsByForm.getOrDefault(form.getId(), List.of())))
                .toList();
    }

    /**
     * Maps a form and its active questions to the representation exposed by the API.
     *
     * @param form      stored form
     * @param questions active questions, already ordered
     * @return form response
     */
    private static FormResponseDTO toResponse(Form form, List<Question> questions) {
        List<QuestionResponseDTO> questionList = questions.stream()
                .map(question -> new QuestionResponseDTO(
                        question.getId(),
                        question.getStatement(),
                        question.getQuestionOrder(),
                        question.getWeight(),
                        question.isActive()))
                .toList();
        return new FormResponseDTO(
                form.getId(),
                form.getTitle(),
                form.getDescription(),
                form.getPublicationYear(),
                form.isActive(),
                form.getCreatedAt(),
                questionList);
    }
}
