package com.mgs.ergomanager.service.impl;

import com.mgs.ergomanager.model.enums.HistoryType;
import com.mgs.ergomanager.dto.selfevaluation.AnswerRequestDTO;
import com.mgs.ergomanager.dto.selfevaluation.AnswerResponseDTO;
import com.mgs.ergomanager.dto.selfevaluation.SelfEvaluationRequestDTO;
import com.mgs.ergomanager.dto.selfevaluation.SelfEvaluationResponseDTO;
import com.mgs.ergomanager.exception.BusinessException;
import com.mgs.ergomanager.exception.ResourceNotFoundException;
import com.mgs.ergomanager.model.Answer;
import com.mgs.ergomanager.model.Company;
import com.mgs.ergomanager.model.Form;
import com.mgs.ergomanager.model.Question;
import com.mgs.ergomanager.model.SelfEvaluation;
import com.mgs.ergomanager.model.enums.RiskLevel;
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

    /** Highest score an answer can have. */
    private static final int MAX_ANSWER_SCORE = 3;

    private static final String INCOMPLETE_ANSWERS_MESSAGE = "Responda todas las preguntas del formulario.";

    private static final Comparator<Answer> BY_QUESTION_ORDER =
            Comparator.comparing((Answer answer) -> answer.getQuestion().getQuestionOrder())
                    .thenComparing(Answer::getId);

    private final SelfEvaluationRepository selfEvaluationRepository;

    private final AnswerRepository answerRepository;

    private final FormRepository formRepository;

    private final QuestionRepository questionRepository;

    private final CompanyRepository companyRepository;

    private final HistoryRepository historyRepository;

    /**
     * Builds the service with its repositories.
     *
     * @param selfEvaluationRepository repository of self evaluations
     * @param answerRepository         repository of answers
     * @param formRepository           repository of forms
     * @param questionRepository       repository of questions
     * @param companyRepository        repository of client companies
     * @param historyRepository        repository of history entries
     */
    public SelfEvaluationServiceImpl(SelfEvaluationRepository selfEvaluationRepository,
                                     AnswerRepository answerRepository,
                                     FormRepository formRepository,
                                     QuestionRepository questionRepository,
                                     CompanyRepository companyRepository,
                                     HistoryRepository historyRepository) {
        this.selfEvaluationRepository = selfEvaluationRepository;
        this.answerRepository = answerRepository;
        this.formRepository = formRepository;
        this.questionRepository = questionRepository;
        this.companyRepository = companyRepository;
        this.historyRepository = historyRepository;
    }

    @Override
    @Transactional
    public SelfEvaluationResponseDTO submit(SelfEvaluationRequestDTO request) {
        Form form = formRepository.findById(request.formId())
                .orElseThrow(() -> new ResourceNotFoundException("No se encontró el formulario."));
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
        validateAnswers(request.answerList(), questionsById);

        int totalScore = 0;
        int maxScore = 0;
        for (Question question : questions) {
            maxScore += MAX_ANSWER_SCORE * question.getWeight();
        }

        SelfEvaluation selfEvaluation = new SelfEvaluation();
        selfEvaluation.setForm(form);
        selfEvaluation.setCompany(company);
        selfEvaluation.setEmployeeName(request.employeeName());
        selfEvaluation.setEmployeeEmail(request.employeeEmail());
        selfEvaluation.setEmployeePosition(request.employeePosition());

        List<Answer> answers = new ArrayList<>();
        for (AnswerRequestDTO answerRequest : request.answerList()) {
            Question question = questionsById.get(answerRequest.questionId());
            totalScore += answerRequest.score() * question.getWeight();
            Answer answer = new Answer();
            answer.setSelfEvaluation(selfEvaluation);
            answer.setQuestion(question);
            answer.setSelectedOption(answerRequest.selectedOption());
            answer.setScore(answerRequest.score());
            answers.add(answer);
        }
        RiskLevel riskLevel = calculateRiskLevel(totalScore, maxScore);
        selfEvaluation.setTotalScore(totalScore);
        selfEvaluation.setRiskLevel(riskLevel);

        SelfEvaluation saved = selfEvaluationRepository.save(selfEvaluation);
        List<Answer> savedAnswers = answerRepository.saveAll(answers);
        historyRepository.save(HistoryEntries.of(HistoryType.SELF_EVALUATION, saved, null,
                "Autoevaluación \"" + form.getTitle() + "\" enviada. Riesgo " + riskLevel.getLabel()
                        + " (" + totalScore + " pts)."));

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

    @Override
    public RiskLevel calculateRiskLevel(int totalScore, int maxScore) {
        if (maxScore <= 0) {
            return RiskLevel.LOW;
        }
        double percentage = totalScore * 100.0 / maxScore;
        if (percentage < 25) {
            return RiskLevel.LOW;
        }
        if (percentage < 50) {
            return RiskLevel.MEDIUM;
        }
        if (percentage < 75) {
            return RiskLevel.HIGH;
        }
        return RiskLevel.CRITICAL;
    }

    /**
     * Checks that every active question is answered exactly once and that no
     * other question is answered.
     *
     * @param answers       answers sent by the employee
     * @param questionsById active questions of the form
     */
    private static void validateAnswers(List<AnswerRequestDTO> answers, Map<Long, Question> questionsById) {
        Set<Long> answered = new HashSet<>();
        for (AnswerRequestDTO answer : answers) {
            if (!questionsById.containsKey(answer.questionId()) || !answered.add(answer.questionId())) {
                throw new BusinessException(INCOMPLETE_ANSWERS_MESSAGE);
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
                selfEvaluation.getRiskLevel(),
                selfEvaluation.getSubmittedAt(),
                answerList);
    }
}
