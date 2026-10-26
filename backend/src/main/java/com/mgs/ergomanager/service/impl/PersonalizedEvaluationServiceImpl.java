package com.mgs.ergomanager.service.impl;

import com.mgs.ergomanager.model.enums.HistoryType;
import com.mgs.ergomanager.dto.personalizedevaluation.PersonalizedAnswerRequestDTO;
import com.mgs.ergomanager.dto.personalizedevaluation.PersonalizedAnswerResponseDTO;
import com.mgs.ergomanager.dto.personalizedevaluation.PersonalizedEvaluationRequestDTO;
import com.mgs.ergomanager.dto.personalizedevaluation.PersonalizedEvaluationResponseDTO;
import com.mgs.ergomanager.exception.BusinessException;
import com.mgs.ergomanager.exception.DuplicateResourceException;
import com.mgs.ergomanager.exception.ResourceNotFoundException;
import com.mgs.ergomanager.model.Appointment;
import com.mgs.ergomanager.model.Form;
import com.mgs.ergomanager.model.PersonalizedAnswer;
import com.mgs.ergomanager.model.PersonalizedEvaluation;
import com.mgs.ergomanager.model.Question;
import com.mgs.ergomanager.model.SelfEvaluation;
import com.mgs.ergomanager.model.User;
import com.mgs.ergomanager.model.enums.AppointmentStatus;
import com.mgs.ergomanager.model.enums.FormType;
import com.mgs.ergomanager.repository.AppointmentRepository;
import com.mgs.ergomanager.repository.FormRepository;
import com.mgs.ergomanager.repository.HistoryRepository;
import com.mgs.ergomanager.repository.PersonalizedAnswerRepository;
import com.mgs.ergomanager.repository.PersonalizedEvaluationRepository;
import com.mgs.ergomanager.repository.QuestionRepository;
import com.mgs.ergomanager.security.CurrentUserService;
import com.mgs.ergomanager.service.PersonalizedEvaluationService;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Default implementation of {@link PersonalizedEvaluationService}. An
 * ergonomist only reads their own evaluations; an administrator reads all.
 */
@Service
public class PersonalizedEvaluationServiceImpl implements PersonalizedEvaluationService {

    private static final String EVALUATION_NOT_FOUND_MESSAGE = "No se encontró la evaluación.";
    private static final String INCOMPLETE_ANSWERS_MESSAGE =
            "Complete el diagnóstico y la recomendación de todas las preguntas.";
    private static final String REPORT_PATH_TEMPLATE = "/api/personalized-evaluations/%d/report";
    private final PersonalizedEvaluationRepository personalizedEvaluationRepository;
    private final PersonalizedAnswerRepository personalizedAnswerRepository;
    private final AppointmentRepository appointmentRepository;
    private final FormRepository formRepository;
    private final QuestionRepository questionRepository;
    private final HistoryRepository historyRepository;
    private final CurrentUserService currentUserService;

    /**
     * Builds the service with its collaborators.
     *
     * @param personalizedEvaluationRepository repository of personalized evaluations
     * @param personalizedAnswerRepository     repository of the answers of the personalized evaluations
     * @param appointmentRepository            repository of appointments
     * @param formRepository                   repository of forms
     * @param questionRepository               repository of questions
     * @param historyRepository                repository of history entries
     * @param currentUserService               access to the signed in user
     */
    public PersonalizedEvaluationServiceImpl(PersonalizedEvaluationRepository personalizedEvaluationRepository,
                                             PersonalizedAnswerRepository personalizedAnswerRepository,
                                             AppointmentRepository appointmentRepository,
                                             FormRepository formRepository,
                                             QuestionRepository questionRepository,
                                             HistoryRepository historyRepository,
                                             CurrentUserService currentUserService) {
        this.personalizedEvaluationRepository = personalizedEvaluationRepository;
        this.personalizedAnswerRepository = personalizedAnswerRepository;
        this.appointmentRepository = appointmentRepository;
        this.formRepository = formRepository;
        this.questionRepository = questionRepository;
        this.historyRepository = historyRepository;
        this.currentUserService = currentUserService;
    }

    @Override
    @Transactional
    public PersonalizedEvaluationResponseDTO create(PersonalizedEvaluationRequestDTO request) {
        User ergonomist = currentUserService.getCurrentUser();
        Appointment appointment = appointmentRepository.findDetailedById(request.appointmentId())
                .orElseThrow(() -> new ResourceNotFoundException("No se encontró la cita."));
        if (!Objects.equals(appointment.getUser().getId(), ergonomist.getId())) {
            throw new AccessDeniedException(CurrentUserService.ACCESS_DENIED_MESSAGE);
        }
        if (!appointment.getSelfEvaluation().getCompany().isActive()) {
            throw new BusinessException("La empresa está inactiva. No se pueden registrar evaluaciones.");
        }
        // Checked before the status: an evaluated appointment is already COMPLETED,
        // and "already evaluated" is the more useful answer in that case.
        if (personalizedEvaluationRepository.existsByAppointmentId(appointment.getId())) {
            throw new DuplicateResourceException("Esta cita ya tiene una evaluación.");
        }
        if (!appointment.getStatus().isPending()) {
            throw new BusinessException("La cita no está pendiente.");
        }
        Form form = getAnswerableForm(request.formId());
        List<Question> questions = questionRepository.findByFormIdAndActiveTrueOrderByQuestionOrderAsc(form.getId());
        Map<Long, Question> questionsById = questions.stream()
                .collect(Collectors.toMap(Question::getId, Function.identity()));
        validateAnswers(request.answerList(), questionsById);

        PersonalizedEvaluation evaluation = new PersonalizedEvaluation();
        evaluation.setAppointment(appointment);
        evaluation.setUser(ergonomist);
        evaluation.setForm(form);
        PersonalizedEvaluation saved = personalizedEvaluationRepository.save(evaluation);
        saved.setReportPath(String.format(REPORT_PATH_TEMPLATE, saved.getId()));

        List<PersonalizedAnswer> answers = new ArrayList<>();
        for (PersonalizedAnswerRequestDTO answerRequest : request.answerList()) {
            Question question = questionsById.get(answerRequest.questionId());
            PersonalizedAnswer answer = new PersonalizedAnswer();
            answer.setEvaluation(saved);
            answer.setQuestion(question);
            // Copies, so the report keeps the question as it was if the form is edited.
            answer.setStatement(question.getStatement());
            answer.setQuestionOrder(question.getQuestionOrder());
            answer.setDiagnosis(answerRequest.diagnosis());
            answer.setRecommendation(answerRequest.recommendation());
            answers.add(answer);
        }
        List<PersonalizedAnswer> savedAnswers = personalizedAnswerRepository.saveAll(answers);
        appointment.setStatus(AppointmentStatus.COMPLETED);

        historyRepository.save(HistoryEntries.of(HistoryType.PERSONALIZED_EVALUATION, appointment.getSelfEvaluation(), saved,
                "Evaluación personalizada \"" + form.getTitle() + "\" registrada."));
        return toResponse(saved, savedAnswers);
    }

    @Override
    @Transactional(readOnly = true)
    public PersonalizedEvaluationResponseDTO findById(Long id) {
        PersonalizedEvaluation evaluation = getReadableEvaluation(id);
        return toResponse(evaluation, personalizedAnswerRepository.findByEvaluationIdOrderByQuestionOrderAscIdAsc(id));
    }

    @Override
    @Transactional(readOnly = true)
    public List<PersonalizedEvaluationResponseDTO> findByErgonomist(Long userId) {
        // Each one lists only their own evaluations, administrators included.
        currentUserService.checkOwner(userId);
        List<PersonalizedEvaluation> evaluations = personalizedEvaluationRepository.findDetailedByUserId(userId);
        if (evaluations.isEmpty()) {
            return List.of();
        }
        Map<Long, List<PersonalizedAnswer>> answersByEvaluation = personalizedAnswerRepository
                .findByEvaluationIdInOrderByQuestionOrderAscIdAsc(
                        evaluations.stream().map(PersonalizedEvaluation::getId).toList())
                .stream()
                .collect(Collectors.groupingBy(answer -> answer.getEvaluation().getId()));
        return evaluations.stream()
                .map(evaluation -> toResponse(evaluation,
                        answersByEvaluation.getOrDefault(evaluation.getId(), List.of())))
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public byte[] generateReport(Long id) {
        PersonalizedEvaluation evaluation = getReadableEvaluation(id);
        return EvaluationReportPdf.render(evaluation, personalizedAnswerRepository.findByEvaluationIdOrderByQuestionOrderAscIdAsc(id));
    }

    /**
     * Reads the form chosen by the ergonomist and checks that it is the active
     * personalized evaluation form.
     *
     * @param formId identifier of the form
     * @return the form
     */
    private Form getAnswerableForm(Long formId) {
        Form form = formRepository.findById(formId)
                .orElseThrow(() -> new BusinessException("El formulario seleccionado no existe."));
        if (form.getType() != FormType.PERSONALIZED_EVALUATION) {
            throw new BusinessException("El formulario seleccionado no es una evaluación personalizada.");
        }
        if (!form.isActive()) {
            throw new BusinessException("El formulario seleccionado no está activo.");
        }
        return form;
    }

    /**
     * Checks that every active question of the form is answered exactly once and
     * that no other question is answered.
     *
     * @param answers       answers written by the ergonomist
     * @param questionsById active questions of the form
     */
    private static void validateAnswers(List<PersonalizedAnswerRequestDTO> answers, Map<Long, Question> questionsById) {
        Set<Long> answered = new HashSet<>();
        for (PersonalizedAnswerRequestDTO answer : answers) {
            if (!questionsById.containsKey(answer.questionId()) || !answered.add(answer.questionId())) {
                throw new BusinessException(INCOMPLETE_ANSWERS_MESSAGE);
            }
        }
        if (answered.size() != questionsById.size()) {
            throw new BusinessException(INCOMPLETE_ANSWERS_MESSAGE);
        }
    }

    /**
     * Reads an evaluation with its associations and applies the ownership rule.
     *
     * @param id identifier of the evaluation
     * @return the evaluation
     */
    private PersonalizedEvaluation getReadableEvaluation(Long id) {
        PersonalizedEvaluation evaluation = personalizedEvaluationRepository.findDetailedById(id)
                .orElseThrow(() -> new ResourceNotFoundException(EVALUATION_NOT_FOUND_MESSAGE));
        currentUserService.checkOwnerOrAdmin(evaluation.getUser().getId());
        return evaluation;
    }

    /**
     * Maps an evaluation to the representation exposed by the API.
     *
     * @param evaluation evaluation with its appointment, self evaluation, company and ergonomist loaded
     * @param answers    answers of the evaluation, in the order of the questions
     * @return evaluation response
     */
    private static PersonalizedEvaluationResponseDTO toResponse(PersonalizedEvaluation evaluation,
                                                                List<PersonalizedAnswer> answers) {
        SelfEvaluation selfEvaluation = evaluation.getAppointment().getSelfEvaluation();
        Form form = evaluation.getForm();
        List<PersonalizedAnswerResponseDTO> answerList = answers.stream()
                .map(answer -> new PersonalizedAnswerResponseDTO(
                        answer.getId(),
                        answer.getQuestion().getId(),
                        answer.getQuestionOrder(),
                        answer.getStatement(),
                        answer.getDiagnosis(),
                        answer.getRecommendation()))
                .toList();
        return new PersonalizedEvaluationResponseDTO(
                evaluation.getId(),
                evaluation.getAppointment().getId(),
                evaluation.getUser().getId(),
                selfEvaluation.getEmployeeName(),
                form == null ? null : form.getId(),
                form == null ? null : form.getTitle(),
                evaluation.getReportPath(),
                evaluation.getEvaluatedAt(),
                selfEvaluation.getEmployeeEmail(),
                selfEvaluation.getCompany().getBusinessName(),
                answerList);
    }
}
