package com.mgs.ergomanager.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.mgs.ergomanager.model.AnswerOption;
import com.mgs.ergomanager.model.Form;
import com.mgs.ergomanager.model.User;
import com.mgs.ergomanager.model.enums.FormType;
import com.mgs.ergomanager.model.enums.Role;
import com.mgs.ergomanager.repository.AnswerOptionRepository;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.IntStream;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

/** Creation and edition of self evaluation and personalized evaluation forms. */
class FormTypeIntegrationTests extends ApiIntegrationTestSupport {

    private static final String SELF = "SELF_EVALUATION";
    private static final String PERSONALIZED = "PERSONALIZED_EVALUATION";

    @Autowired
    private AnswerOptionRepository answerOptionRepository;

    private User admin;

    @BeforeEach
    void createAdmin() {
        admin = persistUser("admin.form.types@example.test", Role.ADMIN);
    }

    private static Map<String, Object> option(Long id, String label, Integer weight, int order) {
        Map<String, Object> option = new HashMap<>();
        option.put("id", id);
        option.put("label", label);
        option.put("weight", weight);
        option.put("optionOrder", order);
        return option;
    }

    private static Map<String, Object> question(Long id, String statement, int order, List<Map<String, Object>> options) {
        Map<String, Object> question = new HashMap<>();
        question.put("id", id);
        question.put("statement", statement);
        question.put("questionOrder", order);
        question.put("optionList", options);
        return question;
    }

    private static Map<String, Object> form(String type, List<Map<String, Object>> questions) {
        Map<String, Object> form = new HashMap<>();
        form.put("title", "Formulario " + type);
        form.put("publicationYear", 2026);
        form.put("type", type);
        form.put("questionList", questions);
        return form;
    }

    private MockHttpServletRequestBuilder create(Map<String, Object> body) {
        return post("/api/forms").with(as(admin)).contentType(MediaType.APPLICATION_JSON).content(toJson(body));
    }

    private MockHttpServletRequestBuilder update(long id, Map<String, Object> body) {
        return put("/api/forms/{id}", id).with(as(admin)).contentType(MediaType.APPLICATION_JSON).content(toJson(body));
    }

    private static List<Map<String, Object>> riskScale() {
        return List.of(option(null, "Nunca", 1, 1), option(null, "A veces", 2, 2), option(null, "Siempre", 3, 3));
    }

    // ----- self evaluation -----

    @Test
    void createsSelfEvaluationWithItsOwnWeightedAnswersPerQuestion() throws Exception {
        mvc.perform(create(form(SELF, List.of(
                        question(null, "¿Siente dolor de espalda?", 1, riskScale()),
                        question(null, "¿Su silla es ajustable?", 2, List.of(
                                option(null, " Sí ", 1, 1),
                                option(null, "No", 3, 2)))))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("type").value(SELF))
                .andExpect(jsonPath("questionList[0].optionList.length()").value(3))
                .andExpect(jsonPath("questionList[0].optionList[1].label").value("A veces"))
                .andExpect(jsonPath("questionList[0].optionList[1].weight").value(2))
                .andExpect(jsonPath("questionList[1].optionList.length()").value(2))
                .andExpect(jsonPath("questionList[1].optionList[0].label").value("Sí"))
                .andExpect(jsonPath("questionList[1].optionList[1].weight").value(3));
    }

    @Test
    void selfEvaluationQuestionsNeedBetweenOneAndTenDistinctAnswers() throws Exception {
        mvc.perform(create(form(SELF, List.of(question(null, "Sin respuestas", 1, List.of())))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("message").value("Agregue al menos una respuesta a la pregunta 1."));
        mvc.perform(create(form(SELF, List.of(question(null, "Sin lista", 1, null)))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("message").value("Agregue al menos una respuesta a la pregunta 1."));

        List<Map<String, Object>> eleven = IntStream.rangeClosed(1, 11)
                .mapToObj(index -> option(null, "Respuesta " + index, 1, index))
                .toList();
        mvc.perform(create(form(SELF, List.of(question(null, "Demasiadas", 2, eleven)))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("message").value("Use un máximo de 10 respuestas en la pregunta 2."));

        mvc.perform(create(form(SELF, List.of(question(null, "Repetidas", 3, List.of(
                        option(null, "Siempre", 3, 1),
                        option(null, " SIEMPRE ", 2, 2)))))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("message").value("Las respuestas de la pregunta 3 no se pueden repetir."));

        // A single predefined answer is allowed.
        mvc.perform(create(form(SELF, List.of(question(null, "Única", 1, List.of(option(null, "Sí", 1, 1)))))))
                .andExpect(status().isCreated());
    }

    @Test
    void validatesTheWeightAndTextOfEachAnswer() throws Exception {
        mvc.perform(create(form(SELF, List.of(question(null, "Pesos", 1, List.of(
                        option(null, "Bajo cero", 0, 1),
                        option(null, "Sobre tres", 4, 2),
                        option(null, " ", null, 3)))))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors['questionList[0].optionList[0].weight']")
                        .value("El peso debe estar entre 1 y 3."))
                .andExpect(jsonPath("$.fieldErrors['questionList[0].optionList[1].weight']")
                        .value("El peso debe estar entre 1 y 3."))
                .andExpect(jsonPath("$.fieldErrors['questionList[0].optionList[2].weight']")
                        .value("Este campo es obligatorio."))
                .andExpect(jsonPath("$.fieldErrors['questionList[0].optionList[2].label']")
                        .value("Este campo es obligatorio."));
        assertThat(formRepository.count()).isZero();
    }

    // ----- personalized evaluation -----

    @Test
    void createsPersonalizedEvaluationWithQuestionsOnly() throws Exception {
        mvc.perform(create(form(PERSONALIZED, List.of(
                        question(null, "Postura frente a la pantalla", 1, null),
                        question(null, "Distribución del escritorio", 2, List.of())))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("type").value(PERSONALIZED))
                .andExpect(jsonPath("questionList.length()").value(2))
                .andExpect(jsonPath("questionList[0].optionList.length()").value(0))
                .andExpect(jsonPath("questionList[1].optionList.length()").value(0));
    }

    @Test
    void personalizedEvaluationQuestionsCannotHavePredefinedAnswers() throws Exception {
        mvc.perform(create(form(PERSONALIZED, List.of(question(null, "Con respuestas", 1, riskScale())))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("message")
                        .value("Las preguntas de una evaluación personalizada no llevan respuestas predefinidas."));
    }

    // ----- common rules -----

    @Test
    void requiresTheTypeAndRejectsAnUnknownOne() throws Exception {
        Map<String, Object> withoutType = form(SELF, List.of(question(null, "Pregunta", 1, riskScale())));
        withoutType.remove("type");
        mvc.perform(create(withoutType))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("fieldErrors.type").value("Seleccione el tipo de formulario."));

        mvc.perform(create(form("OTRO", List.of(question(null, "Pregunta", 1, riskScale())))))
                .andExpect(status().isBadRequest());
    }

    @Test
    void acceptsUpToOneHundredQuestions() throws Exception {
        List<Map<String, Object>> questions = new ArrayList<>();
        for (int order = 1; order <= 101; order++) {
            questions.add(question(null, "Pregunta " + order, order, null));
        }
        mvc.perform(create(form(PERSONALIZED, questions)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("fieldErrors.questionList").value("Use un máximo de 100 preguntas."));

        questions.removeLast();
        mvc.perform(create(form(PERSONALIZED, questions)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("questionList.length()").value(100));
    }

    @Test
    void theTypeCannotChangeAfterCreation() throws Exception {
        long id = idOf(mvc.perform(create(form(SELF, List.of(question(null, "Pregunta", 1, riskScale())))))
                .andExpect(status().isCreated()).andReturn());

        mvc.perform(update(id, form(PERSONALIZED, List.of(question(null, "Pregunta", 1, null)))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("message").value("No se puede cambiar el tipo de un formulario. Cree uno nuevo."));
    }

    // ----- edition of the answers -----

    @Test
    void updatesAnswersInPlaceAddsNewOnesAndHidesMissingOnes() throws Exception {
        MvcResult created = mvc.perform(create(form(SELF, List.of(question(null, "Pregunta", 1, riskScale())))))
                .andExpect(status().isCreated()).andReturn();
        long formId = idOf(created);
        long questionId = ((Number) read(created, "$.questionList[0].id")).longValue();
        long never = ((Number) read(created, "$.questionList[0].optionList[0].id")).longValue();
        long sometimes = ((Number) read(created, "$.questionList[0].optionList[1].id")).longValue();
        long always = ((Number) read(created, "$.questionList[0].optionList[2].id")).longValue();

        mvc.perform(update(formId, form(SELF, List.of(question(questionId, "Pregunta", 1, List.of(
                        option(always, "Siempre", 3, 3),
                        option(never, "Casi nunca", 1, 1),
                        option(null, "Con frecuencia", 2, 2)))))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("questionList[0].optionList.length()").value(3))
                .andExpect(jsonPath("questionList[0].optionList[0].id").value(never))
                .andExpect(jsonPath("questionList[0].optionList[0].label").value("Casi nunca"))
                .andExpect(jsonPath("questionList[0].optionList[1].label").value("Con frecuencia"))
                .andExpect(jsonPath("questionList[0].optionList[2].id").value(always));

        // The removed answer is kept hidden, because stored answers may point to it.
        AnswerOption hidden = answerOptionRepository.findById(sometimes).orElseThrow();
        assertThat(hidden.isActive()).isFalse();
        assertThat(answerOptionRepository.findByQuestionIdIn(List.of(questionId))).hasSize(4);
    }

    @Test
    void rejectsAnswerOfAnotherQuestionOrRepeatedAnswer() throws Exception {
        MvcResult created = mvc.perform(create(form(SELF, List.of(
                        question(null, "Primera", 1, riskScale()),
                        question(null, "Segunda", 2, riskScale())))))
                .andExpect(status().isCreated()).andReturn();
        long formId = idOf(created);
        long first = ((Number) read(created, "$.questionList[0].id")).longValue();
        long second = ((Number) read(created, "$.questionList[1].id")).longValue();
        long optionOfFirst = ((Number) read(created, "$.questionList[0].optionList[0].id")).longValue();
        long optionOfSecond = ((Number) read(created, "$.questionList[1].optionList[0].id")).longValue();

        mvc.perform(update(formId, form(SELF, List.of(
                        question(first, "Primera", 1, List.of(option(optionOfSecond, "Nunca", 1, 1))),
                        question(second, "Segunda", 2, riskScale())))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("message")
                        .value("La respuesta " + optionOfSecond + " no pertenece a la pregunta 1."));

        mvc.perform(update(formId, form(SELF, List.of(
                        question(first, "Primera", 1, List.of(
                                option(optionOfFirst, "Nunca", 1, 1),
                                option(optionOfFirst, "Siempre", 3, 2)))))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("message").value("La respuesta " + optionOfFirst + " está repetida."));
    }

    // ----- listing -----

    @Test
    void filtersTheListByType() throws Exception {
        Form selfEvaluation = persistForm("Autoevaluación", 1);
        Form personalized = persistForm("Entrevista", 1);
        personalized.setType(FormType.PERSONALIZED_EVALUATION);
        personalized.setActive(false);
        formRepository.flush();

        mvc.perform(get("/api/forms").param("type", PERSONALIZED).with(as(admin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").value(personalized.getId()))
                .andExpect(jsonPath("$[0].type").value(PERSONALIZED));
        mvc.perform(get("/api/forms").param("type", SELF).with(as(admin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").value(selfEvaluation.getId()));
        mvc.perform(get("/api/forms").with(as(admin)))
                .andExpect(jsonPath("$.length()").value(2));
        mvc.perform(get("/api/forms").param("type", "OTRO").with(as(admin)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("message").value("El valor del parámetro type no es válido."));
    }
}
