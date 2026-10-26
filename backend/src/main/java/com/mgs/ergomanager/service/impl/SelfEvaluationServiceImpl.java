package com.mgs.ergomanager.service.impl;

import com.mgs.ergomanager.model.enums.HistoryType;
import com.mgs.ergomanager.dto.selfevaluation.AnswerRequestDTO;
import com.mgs.ergomanager.dto.selfevaluation.AnswerResponseDTO;
import com.mgs.ergomanager.dto.selfevaluation.SelfEvaluationRequestDTO;
import com.mgs.ergomanager.dto.selfevaluation.SelfEvaluationResponseDTO;
import com.mgs.ergomanager.exception.BusinessException;
import com.mgs.ergomanager.exception.ResourceNotFoundException;
import com.mgs.ergomanager.model.Answer;
import com.mgs.ergomanager.model.AnswerOption;
import com.mgs.ergomanager.model.Company;
import com.mgs.ergomanager.model.Form;
import com.mgs.ergomanager.model.Question;
import com.mgs.ergomanager.model.SelfEvaluation;
import com.mgs.ergomanager.model.enums.FormType;
import com.mgs.ergomanager.model.enums.RiskLevel;
import com.mgs.ergomanager.repository.AnswerOptionRepository;
import com.mgs.ergomanager.repository.AnswerRepository;
import com.mgs.ergomanager.repository.CompanyRepository;
import com.mgs.ergomanager.repository.FormRepository;
import com.mgs.ergomanager.repository.HistoryRepository;
import com.mgs.ergomanager.repository.QuestionRepository;
import com.mgs.ergomanager.repository.SelfEvaluationRepository;
import com.mgs.ergomanager.service.SelfEvaluationService;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Default implementation of {@link SelfEvaluationService}.
 */
@Service
public class SelfEvaluationServiceImpl implements SelfEvaluationService {

    private static final String INCOMPLETE_ANSWERS_MESSAGE = "Responda todas las preguntas del formulario.";

    private static final Comparator<Answer> BY_QUESTION_ORDER =
            Comparator.comparing((Answer answer) -> answer.getQuestion().getQuestionOrder())
                    .thenComparing(Answer::getId);

    private final SelfEvaluationRepository selfEvaluationRepository;
    private final AnswerRepository answerRepository;
    private final FormRepository formRepository;
    private final QuestionRepository questionRepository;
    private final AnswerOptionRepository answerOptionRepository;
    private final CompanyRepository companyRepository;
    private final HistoryRepository historyRepository;

    /**
     * Builds the service with its repositories.
     *
     * @param selfEvaluationRepository repository of self evaluations
     * @param answerRepository         repository of answers
     * @param formRepository           repository of forms
     * @param questionRepository       repository of questions
     * @param answerOptionRepository   repository of the predefined answers of the questions
     * @param companyRepository        repository of client companies
     * @param historyRepository        repository of history entries
     */
    public SelfEvaluationServiceImpl(SelfEvaluationRepository selfEvaluationRepository,
                                     AnswerRepository answerRepository,
                                     FormRepository formRepository,
                                     QuestionRepository questionRepository,
                                     AnswerOptionRepository answerOptionRepository,
                                     CompanyRepository companyRepository,
                                     HistoryRepository historyRepository) {
        this.selfEvaluationRepository = selfEvaluationRepository;
        this.answerRepository = answerRepository;
        this.formRepository = formRepository;
        this.questionRepository = questionRepository;
        this.answerOptionRepository = answerOptionRepository;
        this.companyRepository = companyRepository;
        this.historyRepository = historyRepository;
    }

    @Override
    @Transactional
    public SelfEvaluationResponseDTO submit(SelfEvaluationRequestDTO request) {
        Form form = formRepository.findById(request.formId())
                .orElseThrow(() -> new ResourceNotFoundException("No se encontró el formulario."));
        if (form.getType() != FormType.SELF_EVALUATION) {
            throw new BusinessException("Este formulario no es una autoevaluación.");
        }
        if (!form.isActive()) {
            throw new BusinessException("El formulario ya no está disponible.");
        }
        // 400 instead of 404: the employee types the company number by hand.
        Company company = companyRepository.findById(request.companyId())
                .filter(Company::isActive)
                .orElseThrow(() -> new BusinessException("La empresa no existe o no está activa."));

        List<Question> questions = questionRepository.findByFormIdAndActiveTrueOrderByQuestionOrderAsc(form.getId());
        Map<Long, Question> questionsById = questions.stream()
                .collect(Collectors.toMap(Question::getId, Function.identity()));
        Map<Long, AnswerOption> optionsById = questions.isEmpty() ? Map.of() : answerOptionRepository
                .findByQuestionIdInAndActiveTrueOrderByOptionOrderAsc(questionsById.keySet()).stream()
                .collect(Collectors.toMap(AnswerOption::getId, Function.identity()));
        validateAnswers(request.answerList(), questionsById, optionsById);

        SelfEvaluation selfEvaluation = new SelfEvaluation();
        selfEvaluation.setForm(form);
        selfEvaluation.setCompany(company);
        selfEvaluation.setEmployeeName(request.employeeName());
        selfEvaluation.setEmployeeEmail(request.employeeEmail());
        selfEvaluation.setEmployeePosition(request.employeePosition());

        int totalScore = 0;
        List<Answer> answers = new ArrayList<>();
        for (AnswerRequestDTO answerRequest : request.answerList()) {
            AnswerOption option = optionsById.get(answerRequest.optionId());
            totalScore += option.getWeight();
            Answer answer = new Answer();
            answer.setSelfEvaluation(selfEvaluation);
            answer.setQuestion(questionsById.get(answerRequest.questionId()));
            answer.setOption(option);
            // Copies, so the history keeps what the employee saw if the form is edited.
            answer.setSelectedOption(option.getLabel());
            answer.setScore(option.getWeight());
            answers.add(answer);
        }
        int questionCount = questions.size();
        double riskPercentage = RiskScale.percentageOf(totalScore, questionCount);
        RiskLevel riskLevel = RiskScale.levelOf(totalScore, questionCount);
        selfEvaluation.setTotalScore(totalScore);
        selfEvaluation.setAverageScore(round(RiskScale.averageOf(totalScore, questionCount)));
        selfEvaluation.setRiskPercentage(round(riskPercentage));
        selfEvaluation.setRiskLevel(riskLevel);

        SelfEvaluation saved = selfEvaluationRepository.save(selfEvaluation);
        List<Answer> savedAnswers = answerRepository.saveAll(answers);
        historyRepository.save(HistoryEntries.of(HistoryType.SELF_EVALUATION, saved, null,
                "Autoevaluación \"" + form.getTitle() + "\" enviada. Riesgo " + riskLevel.getLabel()
                        + " (" + Math.round(riskPercentage) + " %)."));

        return toResponse(saved, savedAnswers);
    }

    @Override
    @Transactional(readOnly = true)
    public SelfEvaluationResponseDTO findById(Long id) {
        SelfEvaluation selfEvaluation = selfEvaluationRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("No se encontró la autoevaluación."));
        return toResponse(selfEvaluation, answerRepository.findBySelfEvaluationId(id));
    }

    @Override
    @Transactional(readOnly = true)
    public List<SelfEvaluationResponseDTO> findByCompany(Long companyId) {
        List<SelfEvaluation> selfEvaluations =
                selfEvaluationRepository.findByCompanyIdOrderBySubmittedAtDescIdDesc(companyId);
        if (selfEvaluations.isEmpty()) {
            return List.of();
        }
        Map<Long, List<Answer>> answersBySelfEvaluation = answerRepository
                .findBySelfEvaluationIdIn(selfEvaluations.stream().map(SelfEvaluation::getId).toList())
                .stream()
                .collect(Collectors.groupingBy(answer -> answer.getSelfEvaluation().getId()));
        return selfEvaluations.stream()
                .map(selfEvaluation -> toResponse(selfEvaluation,
                        answersBySelfEvaluation.getOrDefault(selfEvaluation.getId(), List.of())))
                .toList();
    }

    /**
     * Rounds a value to two decimals.
     *
     * @param value value to round
     * @return rounded value
     */
    private static double round(double value) {
        return Math.round(value * 100.0) / 100.0;
    }

    /**
     * Checks that every active question is answered exactly once, that no other
     * question is answered and that each chosen option belongs to its question.
     *
     * @param answers       answers sent by the employee
     * @param questionsById active questions of the form
     * @param optionsById   active options of those questions
     */
    private static void validateAnswers(List<AnswerRequestDTO> answers,
                                        Map<Long, Question> questionsById,
                                        Map<Long, AnswerOption> optionsById) {
        Set<Long> answered = new HashSet<>();
        for (AnswerRequestDTO answer : answers) {
            Question question = questionsById.get(answer.questionId());
            if (question == null || !answered.add(answer.questionId())) {
                throw new BusinessException(INCOMPLETE_ANSWERS_MESSAGE);
            }
            AnswerOption option = optionsById.get(answer.optionId());
            if (option == null || !option.getQuestion().getId().equals(question.getId())) {
                throw new BusinessException("La respuesta seleccionada no corresponde a la pregunta "
                        + question.getQuestionOrder() + ".");
            }
        }
        if (answered.size() != questionsById.size()) {
            throw new BusinessException(INCOMPLETE_ANSWERS_MESSAGE);
        }
    }

    /**
     * Maps a self evaluation and its answers to the representation exposed by the API.
     *
     * @param selfEvaluation stored self evaluation
     * @param answers        answers of the self evaluation, with their questions
     * @return self evaluation response
     */
    private static SelfEvaluationResponseDTO toResponse(SelfEvaluation selfEvaluation, List<Answer> answers) {
        List<AnswerResponseDTO> answerList = answers.stream()
                .sorted(BY_QUESTION_ORDER)
                .map(answer -> new AnswerResponseDTO(
                        answer.getId(),
                        answer.getQuestion().getId(),
                        answer.getQuestion().getStatement(),
                        answer.getOption() == null ? null : answer.getOption().getId(),
                        answer.getSelectedOption(),
                        answer.getScore()))
                .toList();
        return new SelfEvaluationResponseDTO(
                selfEvaluation.getId(),
                selfEvaluation.getForm().getId(),
                selfEvaluation.getCompany().getId(),
                selfEvaluation.getEmployeeName(),
                selfEvaluation.getEmployeeEmail(),
                selfEvaluation.getEmployeePosition(),
                selfEvaluation.getTotalScore(),
                selfEvaluation.getAverageScore(),
                selfEvaluation.getRiskPercentage(),
                selfEvaluation.getRiskLevel(),
                selfEvaluation.getSubmittedAt(),
                answerList);
    }
}
