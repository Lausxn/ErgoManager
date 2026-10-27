package com.mgs.ergomanager.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.mgs.ergomanager.hu.UserStories;
import com.mgs.ergomanager.model.Company;
import com.mgs.ergomanager.model.Form;
import com.mgs.ergomanager.model.Question;
import com.mgs.ergomanager.model.User;
import com.mgs.ergomanager.model.enums.FormType;
import com.mgs.ergomanager.model.enums.Role;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

/** Drafts, one active form per type and the views of the active forms. */
@Tag(UserStories.HU_009)
class FormActivationIntegrationTests extends ApiIntegrationTestSupport {

    private User admin;
    private User ergonomist;

    @BeforeEach
    void createUsers() {
        admin = persistUser("admin.form.activation@example.test", Role.ADMIN);
        ergonomist = persistUser("ergo.form.activation@example.test", Role.ERGONOMIST);
    }

    private static Map<String, Object> personalizedForm(String title) {
        Map<String, Object> question = new HashMap<>();
        question.put("statement", "Postura frente a la pantalla");
        question.put("questionOrder", 1);
        Map<String, Object> form = new HashMap<>();
        form.put("title", title);
        form.put("publicationYear", 2026);
        form.put("type", "PERSONALIZED_EVALUATION");
        form.put("questionList", List.of(question));
        return form;
    }

    private long createPersonalized(String title) throws Exception {
        return idOf(mvc.perform(post("/api/forms").with(as(admin))
                        .contentType(MediaType.APPLICATION_JSON).content(toJson(personalizedForm(title))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("active").value(false))
                .andReturn());
    }

    private Form persistPersonalized(String title, boolean active) {
        Form form = persistForm(title);
        form.setType(FormType.PERSONALIZED_EVALUATION);
        form.setActive(active);
        Question question = new Question();
        question.setForm(form);
        question.setStatement("Postura");
        question.setQuestionOrder(1);
        questionRepository.saveAndFlush(question);
        return formRepository.saveAndFlush(form);
    }

    @Test
    void aSelfEvaluationAndAPersonalizedEvaluationCanBeActiveAtTheSameTime() throws Exception {
        persistForm("Autoevaluación vigente", 1);
        long personalized = createPersonalized("Entrevista 2026");

        mvc.perform(patch("/api/forms/{id}/activate", personalized).with(as(admin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("active").value(true));

        long another = createPersonalized("Entrevista alterna");
        mvc.perform(patch("/api/forms/{id}/activate", another).with(as(admin)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("message")
                        .value("Ya existe una evaluación personalizada activa. Desactívela antes de activar otra."));
    }

    @Test
    void replacesTheActiveSelfEvaluationWithANewDraft() throws Exception {
        Form current = persistForm("Autoevaluación 2025", 1);
        Form draft = persistForm("Autoevaluación 2026", 1, 1);
        draft.setActive(false);
        formRepository.flush();

        mvc.perform(patch("/api/forms/{id}/activate", draft.getId()).with(as(admin)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("message")
                        .value("Ya existe una autoevaluación activa. Desactívela antes de activar otra."));

        mvc.perform(delete("/api/forms/{id}", current.getId()).with(as(admin))).andExpect(status().isNoContent());
        mvc.perform(patch("/api/forms/{id}/activate", draft.getId()).with(as(admin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("questionList.length()").value(2));

        mvc.perform(get("/api/forms/active"))
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").value(draft.getId()));
    }

    @Test
    void onlyCompleteFormsCanBeActivated() throws Exception {
        Form withoutAnswers = persistForm("Sin respuestas", 1);
        withoutAnswers.setActive(false);
        formRepository.flush();
        Question question = questionsOf(withoutAnswers).get(0);
        answerOptionRepository.findByQuestionIdIn(List.of(question.getId()))
                .forEach(option -> option.setActive(false));
        answerOptionRepository.flush();

        mvc.perform(patch("/api/forms/{id}/activate", withoutAnswers.getId()).with(as(admin)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("message").value(
                        "La pregunta 1 no tiene respuestas predefinidas. Agréguelas antes de activar el formulario."));

        Form withoutQuestions = persistForm("Sin preguntas");
        withoutQuestions.setActive(false);
        formRepository.flush();
        mvc.perform(patch("/api/forms/{id}/activate", withoutQuestions.getId()).with(as(admin)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("message").value("Agregue al menos una pregunta antes de activar el formulario."));

        assertThat(formRepository.findById(withoutAnswers.getId()).orElseThrow().isActive()).isFalse();
    }

    @Test
    void thePublicViewOnlyShowsTheSelfEvaluationWithoutWeights() throws Exception {
        persistForm("Autoevaluación", 1);
        persistPersonalized("Entrevista", true);

        mvc.perform(get("/api/forms/active"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].type").value("SELF_EVALUATION"))
                .andExpect(jsonPath("$[0].questionList[0].optionList.length()").value(3))
                .andExpect(jsonPath("$[0].questionList[0].optionList[2].label").value("Alto"))
                .andExpect(jsonPath("$[0].questionList[0].optionList[2].weight").doesNotExist());

        // The staff still sees the weights when it opens the form.
        mvc.perform(get("/api/forms").param("type", "SELF_EVALUATION").with(as(admin)))
                .andExpect(jsonPath("$[0].questionList[0].optionList[2].weight").value(3));
    }

    @Test
    void returnsTheActivePersonalizedEvaluationToTheStaff() throws Exception {
        mvc.perform(get("/api/forms/personalized/active").with(as(ergonomist)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("message").value("No hay una evaluación personalizada activa."));

        persistPersonalized("Borrador", false);
        Form active = persistPersonalized("Entrevista vigente", true);

        mvc.perform(get("/api/forms/personalized/active").with(as(ergonomist)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("id").value(active.getId()))
                .andExpect(jsonPath("type").value("PERSONALIZED_EVALUATION"))
                .andExpect(jsonPath("questionList[0].statement").value("Postura"));
        mvc.perform(get("/api/forms/personalized/active").with(as(admin)))
                .andExpect(status().isOk());
        mvc.perform(get("/api/forms/personalized/active"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void onlySelfEvaluationsAreResentToTheCompanies() throws Exception {
        Form personalized = persistPersonalized("Entrevista", true);
        Company company = persistCompany("Reenvío personalizado", "3-101-000200", true);

        mvc.perform(post("/api/forms/{id}/resend/{companyId}", personalized.getId(), company.getId()).with(as(admin)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("message").value("Solo las autoevaluaciones se reenvían a las empresas."));
    }
}
