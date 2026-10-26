package com.mgs.ergomanager.service.impl;

import com.mgs.ergomanager.dto.form.AnswerOptionRequestDTO;
import com.mgs.ergomanager.dto.form.AnswerOptionResponseDTO;
import com.mgs.ergomanager.dto.form.FormRequestDTO;
import com.mgs.ergomanager.dto.form.FormResponseDTO;
import com.mgs.ergomanager.dto.form.QuestionRequestDTO;
import com.mgs.ergomanager.dto.form.QuestionResponseDTO;
import com.mgs.ergomanager.exception.BusinessException;
import com.mgs.ergomanager.exception.ResourceNotFoundException;
import com.mgs.ergomanager.model.AnswerOption;
import com.mgs.ergomanager.model.Form;
import com.mgs.ergomanager.model.Question;
import com.mgs.ergomanager.model.enums.FormType;
import com.mgs.ergomanager.repository.AnswerOptionRepository;
import com.mgs.ergomanager.repository.FormRepository;
import com.mgs.ergomanager.repository.QuestionRepository;
import com.mgs.ergomanager.service.FormService;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Default implementation of {@link FormService}.
 */
@Service
public class FormServiceImpl implements FormService {

    private static final String FORM_NOT_FOUND_MESSAGE = "No se encontró el formulario.";
    private static final Map<FormType, String> ACTIVE_FORM_EXISTS_MESSAGES = Map.of(
            FormType.SELF_EVALUATION,
            "Ya existe una autoevaluación activa. Desactívela antes de activar otra.",
            FormType.PERSONALIZED_EVALUATION,
            "Ya existe una evaluación personalizada activa. Desactívela antes de activar otra.");
    private static final int MAX_OPTIONS_PER_QUESTION = 10;

    private static final Comparator<Question> BY_ORDER =
            Comparator.comparing(Question::getQuestionOrder).thenComparing(Question::getId);
    private static final Comparator<AnswerOption> BY_OPTION_ORDER =
            Comparator.comparing(AnswerOption::getOptionOrder).thenComparing(AnswerOption::getId);

    private final FormRepository formRepository;
    private final QuestionRepository questionRepository;
    private final AnswerOptionRepository answerOptionRepository;

    /**
     * Builds the service with its repositories.
     *
     * @param formRepository         repository of forms
     * @param questionRepository     repository of questions
     * @param answerOptionRepository repository of the predefined answers of the questions
     */
    public FormServiceImpl(FormRepository formRepository, QuestionRepository questionRepository,
                           AnswerOptionRepository answerOptionRepository) {
        this.formRepository = formRepository;
        this.questionRepository = questionRepository;
        this.answerOptionRepository = answerOptionRepository;
    }

    @Override
    @Transactional(readOnly = true)
    public List<FormResponseDTO> findAll(FormType type) {
        // Filtered in memory: forms stored before the type existed have no value
        // in the column and are read as self evaluations by Form#getType.
        List<Form> forms = formRepository.findAllByOrderByPublicationYearDescCreatedAtDescIdDesc().stream()
                .filter(form -> type == null || form.getType() == type)
                .toList();
        return toResponses(forms);
    }

    @Override
    @Transactional(readOnly = true)
    public List<FormResponseDTO> findActive() {
        List<Form> forms = formRepository.findByActiveTrueOrderByPublicationYearDescCreatedAtDescIdDesc().stream()
                .filter(form -> form.getType() == FormType.SELF_EVALUATION)
                .toList();
        // Public: the employee picks an answer without seeing its risk weight.
        return toResponses(forms).stream().map(FormServiceImpl::withoutWeights).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public FormResponseDTO findActivePersonalized() {
        Form form = formRepository.findByActiveTrueOrderByPublicationYearDescCreatedAtDescIdDesc().stream()
                .filter(candidate -> candidate.getType() == FormType.PERSONALIZED_EVALUATION)
                .findFirst()
                .orElseThrow(() -> new ResourceNotFoundException("No hay una evaluación personalizada activa."));
        return toResponse(form, questionRepository.findByFormIdAndActiveTrueOrderByQuestionOrderAsc(form.getId()));
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
        validateStructure(request.type(), request.questionList());

        // Created as an inactive draft, so the active form of the same type keeps
        // being answered until the new one is activated.
        Form form = new Form();
        copy(request, form);
        form.setType(request.type());
        form.setActive(false);
        Form saved = formRepository.save(form);

        // A new form has no questions yet, so any question or option id sent is ignored.
        List<Question> questions = new ArrayList<>();
        List<AnswerOption> options = new ArrayList<>();
        for (QuestionRequestDTO questionRequest : request.questionList()) {
            Question question = newQuestion(saved, questionRequest);
            questions.add(question);
            for (AnswerOptionRequestDTO optionRequest : questionRequest.optionList()) {
                options.add(newOption(question, optionRequest));
            }
        }
        List<Question> savedQuestions = questionRepository.saveAll(questions);
        answerOptionRepository.saveAll(options);
        return toResponse(saved, activeSorted(savedQuestions));
    }

    @Override
    @Transactional
    public FormResponseDTO update(Long id, FormRequestDTO request) {
        Form form = getForm(id);
        if (request.type() != form.getType()) {
            throw new BusinessException("No se puede cambiar el tipo de un formulario. Cree uno nuevo.");
        }
        validateStructure(form.getType(), request.questionList());
        copy(request, form);

        Map<Long, Question> existing = questionRepository.findByFormId(id).stream()
                .collect(Collectors.toMap(Question::getId, Function.identity()));
        Map<Long, AnswerOption> existingOptions = existing.isEmpty() ? Map.of() : answerOptionRepository
                .findByQuestionIdIn(existing.keySet()).stream()
                .collect(Collectors.toMap(AnswerOption::getId, Function.identity()));
        Set<Long> kept = new HashSet<>();
        Set<Long> keptOptions = new HashSet<>();
        List<Question> toSave = new ArrayList<>();
        List<AnswerOption> optionsToSave = new ArrayList<>();

        for (QuestionRequestDTO questionRequest : request.questionList()) {
            Question question;
            if (questionRequest.id() == null) {
                question = newQuestion(form, questionRequest);
            } else {
                question = existing.get(questionRequest.id());
                if (question == null) {
                    throw new BusinessException("La pregunta " + questionRequest.id() + " no pertenece a este formulario.");
                }
                if (!kept.add(question.getId())) {
                    throw new BusinessException("La pregunta " + questionRequest.id() + " está repetida.");
                }
                question.setStatement(questionRequest.statement());
                question.setQuestionOrder(questionRequest.questionOrder());
                question.setActive(true);
            }
            toSave.add(question);
            optionsToSave.addAll(mergeOptions(question, questionRequest, existingOptions, keptOptions));
        }

        // Questions and options left out are only hidden: stored answers still reference them.
        for (Question question : existing.values()) {
            if (question.isActive() && !kept.contains(question.getId())) {
                question.setActive(false);
                toSave.add(question);
            }
        }
        for (AnswerOption option : existingOptions.values()) {
            if (option.isActive() && kept.contains(option.getQuestion().getId()) && !keptOptions.contains(option.getId())) {
                option.setActive(false);
                optionsToSave.add(option);
            }
        }

        formRepository.save(form);
        List<Question> saved = questionRepository.saveAll(toSave);
        answerOptionRepository.saveAll(optionsToSave);
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
        List<Question> questions = questionRepository.findByFormIdAndActiveTrueOrderByQuestionOrderAsc(id);

        if (form.isActive()) {
            return toResponse(form, questions);
        }

        boolean anotherActive = formRepository.findByActiveTrue().stream()
                .anyMatch(other -> other.getType() == form.getType() && !other.getId().equals(id));
        if (anotherActive) {
            throw new BusinessException(ACTIVE_FORM_EXISTS_MESSAGES.get(form.getType()));
        }

        Map<Long, List<AnswerOption>> optionsByQuestion = optionsByQuestion(questions);
        validateReadyToActivate(form, questions, optionsByQuestion);

        form.setActive(true);
        formRepository.save(form);
        return toResponse(form, questions, optionsByQuestion);
    }

    /**
     * Checks that a form can be answered before it is activated: it needs at
     * least one question and, for a self evaluation, every question needs its
     * predefined answers. Forms stored before the answers existed fail here.
     *
     * @param form              form to activate
     * @param questions         active questions of the form, ordered
     * @param optionsByQuestion active options by question id
     */
    private static void validateReadyToActivate(Form form,
                                                List<Question> questions,
                                                Map<Long, List<AnswerOption>> optionsByQuestion) {
        if (questions.isEmpty()) {
            throw new BusinessException("Agregue al menos una pregunta antes de activar el formulario.");
        }
        if (form.getType() != FormType.SELF_EVALUATION) {
            return;
        }
        for (Question question : questions) {
            if (optionsByQuestion.getOrDefault(question.getId(), List.of()).isEmpty()) {
                throw new BusinessException("La pregunta " + question.getQuestionOrder()
                        + " no tiene respuestas predefinidas. Agréguelas antes de activar el formulario.");
            }
        }
    }

    /**
     * Copies a form response without the weights of its answers, for the
     * public view used by the employees.
     *
     * @param form form response with weights
     * @return the same form without weights
     */
    private static FormResponseDTO withoutWeights(FormResponseDTO form) {
        List<QuestionResponseDTO> questions = form.questionList().stream()
                .map(question -> new QuestionResponseDTO(
                        question.id(),
                        question.statement(),
                        question.questionOrder(),
                        question.active(),
                        question.optionList().stream()
                                .map(option -> new AnswerOptionResponseDTO(
                                        option.id(), option.label(), null, option.optionOrder()))
                                .toList()))
                .toList();
        return new FormResponseDTO(form.id(), form.title(), form.description(), form.publicationYear(),
                form.type(), form.active(), form.createdAt(), questions);
    }

    /**
     * Checks the rules that depend on the type of the form: a self evaluation
     * question needs its own predefined answers, without repeated texts, while a
     * personalized evaluation question has none, because the ergonomist writes
     * the answer.
     *
     * @param type      type of the form
     * @param questions questions sent by the client
     */
    private static void validateStructure(FormType type, List<QuestionRequestDTO> questions) {
        for (QuestionRequestDTO question : questions) {
            List<AnswerOptionRequestDTO> options = question.optionList();
            if (type == FormType.PERSONALIZED_EVALUATION) {
                if (!options.isEmpty()) {
                    throw new BusinessException(
                            "Las preguntas de una evaluación personalizada no llevan respuestas predefinidas.");
                }
                continue;
            }
            if (options.isEmpty()) {
                throw new BusinessException(
                        "Agregue al menos una respuesta a la pregunta " + question.questionOrder() + ".");
            }
            if (options.size() > MAX_OPTIONS_PER_QUESTION) {
                throw new BusinessException("Use un máximo de " + MAX_OPTIONS_PER_QUESTION
                        + " respuestas en la pregunta " + question.questionOrder() + ".");
            }
            Set<String> labels = new HashSet<>();
            for (AnswerOptionRequestDTO option : options) {
                if (!labels.add(option.label().toLowerCase(Locale.ROOT))) {
                    throw new BusinessException(
                            "Las respuestas de la pregunta " + question.questionOrder() + " no se pueden repetir.");
                }
            }
        }
    }

    /**
     * Updates the options of a question in place and adds the new ones.
     *
     * @param question        question that owns the options, saved or not
     * @param request         data of the question with its options
     * @param existingOptions every stored option of the form, by id
     * @param keptOptions     ids of the stored options that are still sent, filled here
     * @return options to save
     */
    private static List<AnswerOption> mergeOptions(Question question,
                                                   QuestionRequestDTO request,
                                                   Map<Long, AnswerOption> existingOptions,
                                                   Set<Long> keptOptions) {
        List<AnswerOption> options = new ArrayList<>();
        for (AnswerOptionRequestDTO optionRequest : request.optionList()) {
            if (optionRequest.id() == null) {
                options.add(newOption(question, optionRequest));
                continue;
            }
            AnswerOption option = existingOptions.get(optionRequest.id());
            if (option == null || question.getId() == null
                    || !option.getQuestion().getId().equals(question.getId())) {
                throw new BusinessException("La respuesta " + optionRequest.id()
                        + " no pertenece a la pregunta " + request.questionOrder() + ".");
            }
            if (!keptOptions.add(option.getId())) {
                throw new BusinessException("La respuesta " + optionRequest.id() + " está repetida.");
            }
            copy(optionRequest, option);
            option.setActive(true);
            options.add(option);
        }
        return options;
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
     * Copies the already normalized request over an option.
     *
     * @param request data sent by the client
     * @param option  entity to fill
     */
    private static void copy(AnswerOptionRequestDTO request, AnswerOption option) {
        option.setLabel(request.label());
        option.setWeight(request.weight());
        option.setOptionOrder(request.optionOrder());
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
        question.setActive(true);
        return question;
    }

    /**
     * Builds a new active option for a question.
     *
     * @param question owner question
     * @param request  data of the option
     * @return unsaved option
     */
    private static AnswerOption newOption(Question question, AnswerOptionRequestDTO request) {
        AnswerOption option = new AnswerOption();
        option.setQuestion(question);
        copy(request, option);
        option.setActive(true);
        return option;
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
     * Maps a list of forms, reading all their active questions and options in
     * two queries.
     *
     * @param forms forms to map
     * @return form responses in the same order
     */
    private List<FormResponseDTO> toResponses(List<Form> forms) {
        if (forms.isEmpty()) {
            return List.of();
        }
        List<Question> questions = questionRepository
                .findByFormIdInAndActiveTrueOrderByQuestionOrderAsc(forms.stream().map(Form::getId).toList());
        Map<Long, List<Question>> questionsByForm = questions.stream()
                .collect(Collectors.groupingBy(question -> question.getForm().getId()));
        Map<Long, List<AnswerOption>> optionsByQuestion = optionsByQuestion(questions);
        return forms.stream()
                .map(form -> toResponse(form, questionsByForm.getOrDefault(form.getId(), List.of()), optionsByQuestion))
                .toList();
    }

    /**
     * Maps a form and its active questions, reading their options in one query.
     *
     * @param form      stored form
     * @param questions active questions, already ordered
     * @return form response
     */
    private FormResponseDTO toResponse(Form form, List<Question> questions) {
        return toResponse(form, questions, optionsByQuestion(questions));
    }

    /**
     * Reads the active options of the given questions, grouped by question.
     *
     * @param questions questions whose options are needed
     * @return ordered active options by question id
     */
    private Map<Long, List<AnswerOption>> optionsByQuestion(List<Question> questions) {
        if (questions.isEmpty()) {
            return Map.of();
        }
        return answerOptionRepository
                .findByQuestionIdInAndActiveTrueOrderByOptionOrderAsc(questions.stream().map(Question::getId).toList())
                .stream()
                .collect(Collectors.groupingBy(option -> option.getQuestion().getId()));
    }

    /**
     * Maps a form, its active questions and their options to the representation
     * exposed by the API.
     *
     * @param form              stored form
     * @param questions         active questions, already ordered
     * @param optionsByQuestion active options by question id
     * @return form response
     */
    private static FormResponseDTO toResponse(Form form,
                                              List<Question> questions,
                                              Map<Long, List<AnswerOption>> optionsByQuestion) {
        List<QuestionResponseDTO> questionList = questions.stream()
                .map(question -> new QuestionResponseDTO(
                        question.getId(),
                        question.getStatement(),
                        question.getQuestionOrder(),
                        question.isActive(),
                        optionsByQuestion.getOrDefault(question.getId(), List.of()).stream()
                                .sorted(BY_OPTION_ORDER)
                                .map(option -> new AnswerOptionResponseDTO(
                                        option.getId(),
                                        option.getLabel(),
                                        option.getWeight(),
                                        option.getOptionOrder()))
                                .toList()))
                .toList();

        return new FormResponseDTO(
                form.getId(),
                form.getTitle(),
                form.getDescription(),
                form.getPublicationYear(),
                form.getType(),
                form.isActive(),
                form.getCreatedAt(),
                questionList);
    }
}
