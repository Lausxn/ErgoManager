package com.mgs.ergomanager.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.mgs.ergomanager.hu.UserStories;
import com.mgs.ergomanager.model.Company;
import com.mgs.ergomanager.model.Form;
import com.mgs.ergomanager.model.Question;
import com.mgs.ergomanager.model.User;
import com.mgs.ergomanager.model.enums.Role;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.mail.MailSendException;
import org.springframework.test.web.servlet.MvcResult;

/** Management of forms, their questions and the annual resend. */
@Tag(UserStories.HU_009)
class FormIntegrationTests extends ApiIntegrationTestSupport {

    private User admin;
    private User ergonomist;

    @BeforeEach
    void createUsers() {
        admin = persistUser("admin.forms@example.test", Role.ADMIN);
        ergonomist = persistUser("ergo.forms@example.test", Role.ERGONOMIST);
    }

    private static Map<String, Object> option(Long id, String label, int weight, int order) {
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

    /** Self evaluation question with two predefined answers. */
    private static Map<String, Object> question(Long id, String statement, int order) {
        return question(id, statement, order, List.of(option(null, "Nunca", 1, 1), option(null, "Siempre", 3, 2)));
    }

    private static Map<String, Object> form(String title, int year, String type, List<Map<String, Object>> questions) {
        Map<String, Object> form = new HashMap<>();
        form.put("title", title);
        form.put("description", "  ");
        form.put("publicationYear", year);
        form.put("type", type);
        form.put("questionList", questions);
        return form;
    }

    private static Map<String, Object> form(String title, int year, List<Map<String, Object>> questions) {
        return form(title, year, "SELF_EVALUATION", questions);
    }

    @Test
    void createsFormWithOrderedQuestions() throws Exception {
        MvcResult result = mvc.perform(post("/api/forms").with(as(admin))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(toJson(form(" Postura 2026 ", 2026, List.of(
                                question(null, "Segunda", 2),
                                question(null, " Primera ", 1))))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("title").value("Postura 2026"))
                .andExpect(jsonPath("description").doesNotExist())
                .andExpect(jsonPath("type").value("SELF_EVALUATION"))
                .andExpect(jsonPath("active").value(false))
                .andExpect(jsonPath("questionList.length()").value(2))
                .andExpect(jsonPath("questionList[0].statement").value("Primera"))
                .andExpect(jsonPath("questionList[0].optionList.length()").value(2))
                .andExpect(jsonPath("questionList[0].optionList[0].label").value("Nunca"))
                .andExpect(jsonPath("questionList[0].optionList[0].weight").value(1))
                .andExpect(jsonPath("questionList[0].optionList[1].label").value("Siempre"))
                .andExpect(jsonPath("questionList[0].optionList[1].weight").value(3))
                .andReturn();
        long id = idOf(result);
        mvc.perform(get("/api/forms/{id}", id).with(as(admin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("questionList[1].statement").value("Segunda"));
        mvc.perform(get("/api/forms/{id}", 999_999).with(as(admin)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("message").value("No se encontró el formulario."));
    }

    @Test
    void createsDraftWhileAnotherFormIsActive() throws Exception {
        persistForm("Activo", 1);

        mvc.perform(post("/api/forms").with(as(admin))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(toJson(form("Nuevo", 2026, List.of(question(null, "Pregunta", 1))))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("active").value(false));
        // The active form keeps being answered while the draft is prepared.
        mvc.perform(get("/api/forms/active"))
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].title").value("Activo"));
    }

    @Test
    void listsNewestYearFirstAndPublishesOnlyActiveForms() throws Exception {
        Form old = persistForm("Antiguo", 1);
        old.setPublicationYear(2024);
        Form inactive = persistForm("Inactivo", 1);
        inactive.setActive(false);
        persistForm("Vigente", 1);
        formRepository.flush();

        mvc.perform(get("/api/forms").with(as(admin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].title").value("Vigente"))
                .andExpect(jsonPath("$[1].title").value("Inactivo"))
                .andExpect(jsonPath("$[2].title").value("Antiguo"));
        // Public: employees answer without an account.
        mvc.perform(get("/api/forms/active"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].title").value("Vigente"))
                .andExpect(jsonPath("$[0].questionList[0].statement").value("Pregunta 1"))
                .andExpect(jsonPath("$[0].questionList[0].optionList[0].label").value("Bajo"))
                .andExpect(jsonPath("$[0].questionList[0].optionList[0].weight").doesNotExist());
    }

    @Test
    void updatesQuestionsInPlaceAddsNewOnesAndHidesMissingOnes() throws Exception {
        Form form = persistForm("Original", 1, 1, 1);
        List<Question> questions = questionsOf(form);
        Question first = questions.get(0);
        Question second = questions.get(1);
        Question third = questions.get(2);

        List<Map<String, Object>> update = new ArrayList<>();
        update.add(question(first.getId(), "Primera editada", 1));
        update.add(question(third.getId(), "Pregunta 3", 2));
        update.add(question(null, "Nueva", 3));
        mvc.perform(put("/api/forms/{id}", form.getId()).with(as(admin))
                        .contentType(MediaType.APPLICATION_JSON).content(toJson(form("Editado", 2027, update))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("title").value("Editado"))
                .andExpect(jsonPath("publicationYear").value(2027))
                .andExpect(jsonPath("questionList.length()").value(3))
                .andExpect(jsonPath("questionList[0].id").value(first.getId()))
                .andExpect(jsonPath("questionList[0].statement").value("Primera editada"))
                .andExpect(jsonPath("questionList[0].optionList.length()").value(2))
                .andExpect(jsonPath("questionList[1].id").value(third.getId()))
                .andExpect(jsonPath("questionList[2].statement").value("Nueva"));

        Question hidden = questionRepository.findById(second.getId()).orElseThrow();
        assertThat(hidden.isActive()).isFalse();
        assertThat(questionRepository.findByFormId(form.getId())).hasSize(4);
    }

    @Test
    void rejectsQuestionOfAnotherForm() throws Exception {
        Form form = persistForm("Propio", 1);
        Form other = persistForm("Ajeno", 1);
        Long foreignId = questionsOf(other).get(0).getId();
        mvc.perform(put("/api/forms/{id}", form.getId()).with(as(admin))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(toJson(form("Propio", 2026, List.of(question(foreignId, "X", 1))))))
                .andExpect(status().isBadRequest());
    }

    @Test
    void validatesFormFields() throws Exception {
        mvc.perform(post("/api/forms").with(as(admin))
                        .contentType(MediaType.APPLICATION_JSON).content(toJson(form(" ", 1999, List.of()))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("fieldErrors.title").value("Este campo es obligatorio."))
                .andExpect(jsonPath("fieldErrors.publicationYear").value("El año debe ser 2000 o posterior."))
                .andExpect(jsonPath("fieldErrors.questionList").value("Agregue al menos una pregunta."));
    }

    @Test
    void deactivatesAndActivates() throws Exception {
        Form form = persistForm("Ciclo", 1);
        mvc.perform(delete("/api/forms/{id}", form.getId()).with(as(admin))).andExpect(status().isNoContent());
        mvc.perform(get("/api/forms/active")).andExpect(jsonPath("$.length()").value(0));
        mvc.perform(patch("/api/forms/{id}/activate", form.getId()).with(as(admin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("active").value(true))
                .andExpect(jsonPath("questionList.length()").value(1));
    }

    @Test
    void rejectsActivatingFormWhenAnotherFormIsActive() throws Exception {
        persistForm("Activo", 1);
        Form inactive = persistForm("Inactivo", 1);
        inactive.setActive(false);
        formRepository.flush();

        mvc.perform(patch("/api/forms/{id}/activate", inactive.getId()).with(as(admin)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("message")
                        .value("Ya existe una autoevaluación activa. Desactívela antes de activar otra."));

        assertThat(formRepository.findById(inactive.getId()).orElseThrow().isActive()).isFalse();
    }

    @Test
    void resendsToContactAndDistinctEmployees() throws Exception {
        Form form = persistForm("Anual", 1);
        Company company = persistCompany("Reenvío", "3-101-000100", true);
        persistSelfEvaluation(form, company, "ana@empresa.test");
        persistSelfEvaluation(form, company, "ana@empresa.test");
        persistSelfEvaluation(form, company, "luis@empresa.test");
        Company otherCompany = persistCompany("Otra", "3-101-000101", true);
        persistSelfEvaluation(form, otherCompany, "externo@otra.test");

        mvc.perform(post("/api/forms/{id}/resend/{companyId}", form.getId(), company.getId()).with(as(admin)))
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("recipientCount").value(3));

        String link = "http://localhost:4200/self-evaluation?companyId=" + company.getId();
        verify(emailService).sendFormInvitation(company.getContactEmail(), "Reenvío", "Anual", link);
        verify(emailService).sendFormInvitation("ana@empresa.test", "Reenvío", "Anual", link);
        verify(emailService).sendFormInvitation("luis@empresa.test", "Reenvío", "Anual", link);
        verify(emailService, never()).sendFormInvitation(eq("externo@otra.test"), anyString(), anyString(), anyString());
    }

    @Test
    void resendCountsOnlySuccessfulEmails() throws Exception {
        Form form = persistForm("Anual", 1);
        Company company = persistCompany("Fallo", "3-101-000102", true);
        persistSelfEvaluation(form, company, "falla@empresa.test");
        doThrow(new MailSendException("SMTP caído"))
                .when(emailService).sendFormInvitation(eq("falla@empresa.test"), anyString(), anyString(), anyString());

        mvc.perform(post("/api/forms/{id}/resend/{companyId}", form.getId(), company.getId()).with(as(admin)))
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("recipientCount").value(1));
        verify(emailService, times(2)).sendFormInvitation(anyString(), anyString(), anyString(), anyString());
    }

    @Test
    @Tag(UserStories.HU_021)
    void resendRequiresActiveFormAndCompany() throws Exception {
        Form form = persistForm("Anual", 1);
        Company inactiveCompany = persistCompany("Inactiva", "3-101-000103", false);
        Company activeCompany = persistCompany("Activa", "3-101-000104", true);
        mvc.perform(post("/api/forms/{id}/resend/{companyId}", form.getId(), inactiveCompany.getId()).with(as(admin)))
                .andExpect(status().isBadRequest());
        mvc.perform(post("/api/forms/{id}/resend/{companyId}", form.getId(), 999_999).with(as(admin)))
                .andExpect(status().isNotFound());
        form.setActive(false);
        formRepository.flush();
        mvc.perform(post("/api/forms/{id}/resend/{companyId}", form.getId(), activeCompany.getId()).with(as(admin)))
                .andExpect(status().isBadRequest());
        verify(emailService, never()).sendFormInvitation(anyString(), anyString(), anyString(), anyString());
    }

    @Test
    void ergonomistHasFullAccessAndAnonymousIsUnauthorized() throws Exception {
        Form form = persistForm("Compartido", 1);
        Company company = persistCompany("Compartida", "3-101-000105", true);

        mvc.perform(get("/api/forms").with(as(ergonomist))).andExpect(status().isOk());
        mvc.perform(get("/api/forms/{id}", form.getId()).with(as(ergonomist))).andExpect(status().isOk());

        mvc.perform(delete("/api/forms/{id}", form.getId()).with(as(ergonomist)))
                .andExpect(status().isNoContent());

        MvcResult created = mvc.perform(post("/api/forms").with(as(ergonomist))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(toJson(form("X", 2026, List.of(question(null, "X", 1))))))
                .andExpect(status().isCreated())
                .andReturn();

        long createdFormId = idOf(created);
        mvc.perform(patch("/api/forms/{id}/activate", createdFormId).with(as(ergonomist)))
                .andExpect(status().isOk());

        mvc.perform(post("/api/forms/{id}/resend/{companyId}", createdFormId, company.getId()).with(as(ergonomist)))
                .andExpect(status().isAccepted());

        mvc.perform(get("/api/forms")).andExpect(status().isUnauthorized());
    }
}