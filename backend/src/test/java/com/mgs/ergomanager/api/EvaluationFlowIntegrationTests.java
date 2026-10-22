package com.mgs.ergomanager.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.lowagie.text.pdf.PdfReader;
import com.lowagie.text.pdf.parser.PdfTextExtractor;
import com.mgs.ergomanager.model.AnswerOption;
import com.mgs.ergomanager.model.Availability;
import com.mgs.ergomanager.model.Company;
import com.mgs.ergomanager.model.Form;
import com.mgs.ergomanager.model.Question;
import com.mgs.ergomanager.model.User;
import com.mgs.ergomanager.model.enums.FormType;
import com.mgs.ergomanager.model.enums.Role;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

/**
 * Whole evaluation flow: self evaluation, availability, booking, personalized
 * evaluation, PDF report and history, with the ownership rules of each role.
 */
class EvaluationFlowIntegrationTests extends ApiIntegrationTestSupport {

    private User admin;
    private User ergonomist;
    private User otherErgonomist;
    private Company company;
    private Form form;
    private List<Question> questions;
    private Form personalizedForm;
    private List<Question> personalizedQuestions;

    @BeforeEach
    void createData() {
        admin = persistUser("admin.flow@example.test", Role.ADMIN);
        ergonomist = persistUser("ergo.flow@example.test", Role.ERGONOMIST);
        otherErgonomist = persistUser("otro.flow@example.test", Role.ERGONOMIST);
        company = persistCompany("Flujo S.A.", "3-101-000200", true);
        // Three questions, each with the answers Bajo (1), Medio (2) and Alto (3).
        form = persistForm("Postura", 1, 1, 1);
        questions = questionsOf(form);
        personalizedForm = persistPersonalizedForm("Entrevista ergonómica", "Postura frente a la pantalla",
                "Distribución del escritorio");
        personalizedQuestions = questionsOf(personalizedForm);
    }

    // ----- helpers -----

    /**
     * Returns the predefined answer of a question that has the given weight.
     *
     * @param question question of the form
     * @param weight   weight of the answer, from 1 to 3
     * @return the predefined answer
     */
    private AnswerOption optionOf(Question question, int weight) {
        return answerOptionRepository.findByQuestionIdIn(List.of(question.getId())).stream()
                .filter(option -> option.getWeight() == weight)
                .findFirst()
                .orElseThrow();
    }

    private Map<String, Object> selfEvaluationBody(Long companyId, int... weights) {
        List<Map<String, Object>> answers = new ArrayList<>();
        for (int index = 0; index < weights.length; index++) {
            Map<String, Object> answer = new HashMap<>();
            answer.put("questionId", questions.get(index).getId());
            answer.put("optionId", optionOf(questions.get(index), weights[index]).getId());
            answers.add(answer);
        }
        Map<String, Object> body = new HashMap<>();
        body.put("formId", form.getId());
        body.put("companyId", companyId);
        body.put("employeeName", " Ana Mora ");
        body.put("employeeEmail", " Ana.Mora@Flujo.TEST ");
        body.put("employeePosition", "Digitadora");
        body.put("answerList", answers);
        return body;
    }

    private long submitSelfEvaluation(int... weights) throws Exception {
        MvcResult result = mvc.perform(post("/api/self-evaluations")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(toJson(selfEvaluationBody(company.getId(), weights))))
                .andExpect(status().isCreated())
                .andReturn();
        return idOf(result);
    }

    private MockHttpServletRequestBuilder availabilityRequest(Long userId, LocalDateTime start, LocalDateTime end) {
        Map<String, Object> body = new HashMap<>();
        body.put("userId", userId);
        body.put("startDateTime", start.format(QUERY_DATE_FORMAT));
        body.put("endDateTime", end.format(QUERY_DATE_FORMAT));
        return post("/api/appointments/availabilities").contentType(MediaType.APPLICATION_JSON).content(toJson(body));
    }

    private MockHttpServletRequestBuilder bookingRequest(long selfEvaluationId, long availabilityId) {
        Map<String, Object> body = new HashMap<>();
        body.put("selfEvaluationId", selfEvaluationId);
        body.put("availabilityId", availabilityId);
        body.put("notes", " Dolor de espalda ");
        return post("/api/appointments").contentType(MediaType.APPLICATION_JSON).content(toJson(body));
    }

    private MockHttpServletRequestBuilder rescheduleRequest(long appointmentId, Long availabilityId) {
        Map<String, Object> body = new HashMap<>();
        if (availabilityId != null) {
            body.put("availabilityId", availabilityId);
        }
        return patch("/api/appointments/{id}/reschedule", appointmentId)
                .contentType(MediaType.APPLICATION_JSON)
                .content(toJson(body));
    }

    /**
     * Stores an active personalized evaluation form with the given questions.
     *
     * @param title      name of the form
     * @param statements texts of the questions, in order
     * @return the stored form
     */
    private Form persistPersonalizedForm(String title, String... statements) {
        Form personalized = persistForm(title);
        personalized.setType(FormType.PERSONALIZED_EVALUATION);
        formRepository.saveAndFlush(personalized);
        List<Question> created = new ArrayList<>();
        for (int index = 0; index < statements.length; index++) {
            Question question = new Question();
            question.setForm(personalized);
            question.setStatement(statements[index]);
            question.setQuestionOrder(index + 1);
            created.add(question);
        }
        questionRepository.saveAllAndFlush(created);
        return personalized;
    }

    private static Map<String, Object> personalizedAnswer(Question question, String diagnosis, String recommendation) {
        Map<String, Object> answer = new HashMap<>();
        answer.put("questionId", question.getId());
        answer.put("diagnosis", diagnosis);
        answer.put("recommendation", recommendation);
        return answer;
    }

    private Map<String, Object> evaluationBody(long appointmentId) {
        Map<String, Object> body = new HashMap<>();
        body.put("appointmentId", appointmentId);
        body.put("formId", personalizedForm.getId());
        body.put("answerList", new ArrayList<>(List.of(
                personalizedAnswer(personalizedQuestions.get(0), " Postura encorvada frente al monitor. ",
                        "Elevar el monitor a la altura de los ojos."),
                personalizedAnswer(personalizedQuestions.get(1), "Teclado lejos del cuerpo.",
                        "Acercar el teclado y usar reposamuñecas."))));
        return body;
    }

    private MockHttpServletRequestBuilder evaluationRequest(Map<String, Object> body) {
        return post("/api/personalized-evaluations").contentType(MediaType.APPLICATION_JSON).content(toJson(body));
    }

    private MockHttpServletRequestBuilder evaluationRequest(long appointmentId) {
        return evaluationRequest(evaluationBody(appointmentId));
    }

    /**
     * Books an appointment with the ergonomist for a new self evaluation.
     *
     * @param daysAhead day of the appointment, to keep the slots of each test apart
     * @return identifier of the appointment
     */
    private long bookAppointment(int daysAhead) throws Exception {
        long selfEvaluationId = submitSelfEvaluation(2, 2, 2);
        Availability slot = persistAvailability(ergonomist, futureAt(daysAhead, 8), futureAt(daysAhead, 9));
        return idOf(mvc.perform(bookingRequest(selfEvaluationId, slot.getId()).with(as(admin)))
                .andExpect(status().isCreated()).andReturn());
    }

    private MockHttpServletRequestBuilder withRange(MockHttpServletRequestBuilder request, Long userId) {
        return request.param("userId", String.valueOf(userId))
                .param("from", futureAt(0, 0).format(QUERY_DATE_FORMAT))
                .param("to", futureAt(60, 23).format(QUERY_DATE_FORMAT));
    }

    // ----- self evaluations -----

    // Average = total / 3 questions; percentage = (average - 1) / 2 * 100. The rows
    // 2-1-2 and 3-2-2 fall exactly on the limits between levels.
    @ParameterizedTest
    @CsvSource({
            "1, 1, 1, 3, 1.0, 0.0, LOW",
            "1, 1, 2, 4, 1.33, 16.67, LOW",
            "2, 1, 2, 5, 1.67, 33.33, MEDIUM",
            "2, 2, 2, 6, 2.0, 50.0, MEDIUM",
            "3, 2, 2, 7, 2.33, 66.67, HIGH",
            "3, 3, 3, 9, 3.0, 100.0, HIGH"
    })
    void calculatesTheRiskLevelFromTheAverageWeight(int first, int second, int third, int total,
                                                    double average, double percentage, String risk)
            throws Exception {
        mvc.perform(post("/api/self-evaluations")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(toJson(selfEvaluationBody(company.getId(), first, second, third))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("totalScore").value(total))
                .andExpect(jsonPath("averageScore").value(average))
                .andExpect(jsonPath("riskPercentage").value(percentage))
                .andExpect(jsonPath("riskLevel").value(risk))
                .andExpect(jsonPath("employeeEmail").value("ana.mora@flujo.test"))
                .andExpect(jsonPath("employeeName").value("Ana Mora"))
                .andExpect(jsonPath("answerList.length()").value(3))
                .andExpect(jsonPath("answerList[0].statement").value("Pregunta 1"))
                .andExpect(jsonPath("answerList[0].optionId").value(optionOf(questions.get(0), first).getId()))
                .andExpect(jsonPath("answerList[0].score").value(first));
    }

    @Test
    void submissionCreatesHistoryEntry() throws Exception {
        long id = submitSelfEvaluation(2, 2, 2);
        mvc.perform(get("/api/histories").param("companyId", String.valueOf(company.getId())).with(as(admin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].selfEvaluationId").value(id))
                .andExpect(jsonPath("$[0].companyName").value("Flujo S.A."))
                .andExpect(jsonPath("$[0].employeeEmail").value("ana.mora@flujo.test"))
                .andExpect(jsonPath("$[0].description").value("Autoevaluación \"Postura\" enviada. Riesgo Medio (50 %)."))
                .andExpect(jsonPath("$[0].type").value("SELF_EVALUATION"));
    }

    @Test
    void rejectsIncompleteOrInvalidSubmissions() throws Exception {
        mvc.perform(post("/api/self-evaluations").contentType(MediaType.APPLICATION_JSON)
                        .content(toJson(selfEvaluationBody(company.getId(), 1, 1))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("message").value("Responda todas las preguntas del formulario."));

        Map<String, Object> repeated = selfEvaluationBody(company.getId(), 1, 1, 1);
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> answers = (List<Map<String, Object>>) repeated.get("answerList");
        answers.get(2).put("questionId", questions.get(0).getId());
        mvc.perform(post("/api/self-evaluations").contentType(MediaType.APPLICATION_JSON).content(toJson(repeated)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("message").value("Responda todas las preguntas del formulario."));

        Map<String, Object> withoutOption = selfEvaluationBody(company.getId(), 1, 1, 1);
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> withoutOptionAnswers = (List<Map<String, Object>>) withoutOption.get("answerList");
        withoutOptionAnswers.get(1).remove("optionId");
        mvc.perform(post("/api/self-evaluations").contentType(MediaType.APPLICATION_JSON).content(toJson(withoutOption)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("fieldErrors['answerList[1].optionId']").value("Seleccione una respuesta."));
    }

    @Test
    void theChosenAnswerMustBelongToItsActiveQuestion() throws Exception {
        Map<String, Object> foreign = selfEvaluationBody(company.getId(), 1, 1, 1);
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> answers = (List<Map<String, Object>>) foreign.get("answerList");
        answers.get(1).put("optionId", optionOf(questions.get(2), 3).getId());
        mvc.perform(post("/api/self-evaluations").contentType(MediaType.APPLICATION_JSON).content(toJson(foreign)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("message").value("La respuesta seleccionada no corresponde a la pregunta 2."));

        AnswerOption hidden = optionOf(questions.get(0), 3);
        hidden.setActive(false);
        answerOptionRepository.flush();
        mvc.perform(post("/api/self-evaluations").contentType(MediaType.APPLICATION_JSON)
                        .content(toJson(selfEvaluationBody(company.getId(), 3, 1, 1))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("message").value("La respuesta seleccionada no corresponde a la pregunta 1."));
    }

    @Test
    void keepsTheAnswerAsTheEmployeeSawItWhenTheFormIsEditedLater() throws Exception {
        long id = submitSelfEvaluation(3, 1, 1);
        AnswerOption chosen = optionOf(questions.get(0), 3);
        chosen.setLabel("Texto editado");
        chosen.setWeight(1);
        answerOptionRepository.flush();

        mvc.perform(get("/api/self-evaluations/{id}", id).with(as(admin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("totalScore").value(5))
                .andExpect(jsonPath("answerList[0].selectedOption").value("Alto"))
                .andExpect(jsonPath("answerList[0].score").value(3));
    }

    @Test
    void aPersonalizedEvaluationFormCannotBeAnsweredAsASelfEvaluation() throws Exception {
        form.setType(FormType.PERSONALIZED_EVALUATION);
        formRepository.flush();
        mvc.perform(post("/api/self-evaluations").contentType(MediaType.APPLICATION_JSON)
                        .content(toJson(selfEvaluationBody(company.getId(), 1, 1, 1))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("message").value("Este formulario no es una autoevaluación."));
    }

    @Test
    void rejectsMissingOrInactiveCompanyAndInactiveForm() throws Exception {
        Company inactive = persistCompany("Inactiva", "3-101-000201", false);
        mvc.perform(post("/api/self-evaluations").contentType(MediaType.APPLICATION_JSON)
                        .content(toJson(selfEvaluationBody(inactive.getId(), 1, 1, 1))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("message").value("La empresa no existe o no está activa."));
        mvc.perform(post("/api/self-evaluations").contentType(MediaType.APPLICATION_JSON)
                        .content(toJson(selfEvaluationBody(999_999L, 1, 1, 1))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("message").value("La empresa no existe o no está activa."));
        form.setActive(false);
        formRepository.flush();
        mvc.perform(post("/api/self-evaluations").contentType(MediaType.APPLICATION_JSON)
                        .content(toJson(selfEvaluationBody(company.getId(), 1, 1, 1))))
                .andExpect(status().isBadRequest());
    }

    @Test
    void readingSelfEvaluationsRequiresSignIn() throws Exception {
        long older = submitSelfEvaluation(1, 1, 1);
        long newer = submitSelfEvaluation(3, 3, 3);
        mvc.perform(get("/api/self-evaluations/{id}", older)).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/self-evaluations/{id}", older).with(as(ergonomist)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("answerList.length()").value(3));
        mvc.perform(get("/api/self-evaluations/{id}", 999_999).with(as(admin))).andExpect(status().isNotFound());
        mvc.perform(get("/api/self-evaluations").param("companyId", String.valueOf(company.getId())).with(as(admin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(newer))
                .andExpect(jsonPath("$[1].id").value(older))
                .andExpect(jsonPath("$[1].answerList.length()").value(3));
    }

    // ----- availability -----

    @Test
    void createsAndListsAvailabilityWithOwnershipRules() throws Exception {
        LocalDateTime start = futureAt(5, 8);
        mvc.perform(availabilityRequest(ergonomist.getId(), start, start.plusHours(1)).with(as(ergonomist)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("userId").value(ergonomist.getId()))
                .andExpect(jsonPath("fullName").value("Nombre Ergo"))
                .andExpect(jsonPath("taken").value(false));
        mvc.perform(availabilityRequest(ergonomist.getId(), start.minusHours(2), start.minusHours(1)).with(as(admin)))
                .andExpect(status().isCreated());
        mvc.perform(availabilityRequest(ergonomist.getId(), start.plusHours(3), start.plusHours(4))
                        .with(as(otherErgonomist)))
                .andExpect(status().isForbidden());
        mvc.perform(availabilityRequest(admin.getId(), start, start.plusHours(1)).with(as(admin)))
                .andExpect(status().isBadRequest());

        mvc.perform(withRange(get("/api/appointments/availabilities"), ergonomist.getId()).with(as(ergonomist)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].startDateTime").value(start.minusHours(2).format(QUERY_DATE_FORMAT)));
        mvc.perform(withRange(get("/api/appointments/availabilities"), ergonomist.getId()).with(as(otherErgonomist)))
                .andExpect(status().isForbidden());
        mvc.perform(withRange(get("/api/appointments/availabilities"), ergonomist.getId()).with(as(admin)))
                .andExpect(status().isOk());
        mvc.perform(withRange(get("/api/appointments/availabilities"), ergonomist.getId()))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void rejectsInvalidOrOverlappingAvailability() throws Exception {
        LocalDateTime start = futureAt(6, 10);
        mvc.perform(availabilityRequest(ergonomist.getId(), start, start.minusMinutes(30)).with(as(ergonomist)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("message").value("La hora de fin debe ser posterior a la de inicio."));
        mvc.perform(availabilityRequest(ergonomist.getId(), LocalDateTime.now().minusDays(1),
                        LocalDateTime.now().minusDays(1).plusHours(1)).with(as(ergonomist)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("fieldErrors.startDateTime").value("La fecha debe ser futura."));
        mvc.perform(availabilityRequest(ergonomist.getId(), start, start.plusHours(1)).with(as(ergonomist)))
                .andExpect(status().isCreated());
        mvc.perform(availabilityRequest(ergonomist.getId(), start.plusMinutes(30), start.plusMinutes(90))
                        .with(as(ergonomist)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("message").value("El horario seleccionado se cruza con una disponibilidad existente. Seleccione otro rango de fecha y hora."));
        // Back to back is not an overlap, and another ergonomist may use the same hour.
        mvc.perform(availabilityRequest(ergonomist.getId(), start.plusHours(1), start.plusHours(2))
                        .with(as(ergonomist)))
                .andExpect(status().isCreated());
        mvc.perform(availabilityRequest(otherErgonomist.getId(), start, start.plusHours(1))
                        .with(as(otherErgonomist)))
                .andExpect(status().isCreated());
    }

    @Test
    void deletesOnlyOwnFreeSlots() throws Exception {
        Availability free = persistAvailability(ergonomist, futureAt(7, 8), futureAt(7, 9));
        Availability taken = persistAvailability(ergonomist, futureAt(7, 10), futureAt(7, 11));
        taken.setTaken(true);
        availabilityRepository.flush();

        mvc.perform(delete("/api/appointments/availabilities/{id}", free.getId()).with(as(otherErgonomist)))
                .andExpect(status().isForbidden());
        mvc.perform(delete("/api/appointments/availabilities/{id}", taken.getId()).with(as(ergonomist)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("message").value("No se puede eliminar un espacio que ya tiene una cita."));
        mvc.perform(delete("/api/appointments/availabilities/{id}", free.getId()).with(as(ergonomist)))
                .andExpect(status().isNoContent());
        assertThat(availabilityRepository.findById(free.getId())).isEmpty();
        mvc.perform(delete("/api/appointments/availabilities/{id}", free.getId()).with(as(ergonomist)))
                .andExpect(status().isNotFound());
    }

    // ----- booking, cancellation and rescheduling -----

    @Test
    void bookingRules() throws Exception {
        long selfEvaluationId = submitSelfEvaluation(3, 3, 3);
        Availability slot = persistAvailability(ergonomist, futureAt(8, 8), futureAt(8, 9));
        Availability otherSlot = persistAvailability(ergonomist, futureAt(8, 10), futureAt(8, 11));
        Availability foreignSlot = persistAvailability(otherErgonomist, futureAt(8, 12), futureAt(8, 13));
        Availability pastSlot = persistAvailability(ergonomist, LocalDateTime.now().minusDays(1),
                LocalDateTime.now().minusDays(1).plusHours(1));

        mvc.perform(bookingRequest(selfEvaluationId, foreignSlot.getId()).with(as(ergonomist)))
                .andExpect(status().isForbidden());
        mvc.perform(bookingRequest(selfEvaluationId, pastSlot.getId()).with(as(admin)))
                .andExpect(status().isBadRequest());
        mvc.perform(bookingRequest(selfEvaluationId, 999_999).with(as(admin))).andExpect(status().isBadRequest());
        mvc.perform(bookingRequest(999_999, slot.getId()).with(as(admin))).andExpect(status().isNotFound());

        mvc.perform(bookingRequest(selfEvaluationId, slot.getId()).with(as(ergonomist)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("status").value("SCHEDULED"))
                .andExpect(jsonPath("userId").value(ergonomist.getId()))
                .andExpect(jsonPath("employeeName").value("Ana Mora"))
                .andExpect(jsonPath("employeeEmail").value("ana.mora@flujo.test"))
                .andExpect(jsonPath("companyId").value(company.getId()))
                .andExpect(jsonPath("companyName").value("Flujo S.A."))
                .andExpect(jsonPath("ergonomistName").value("Nombre Ergo"))
                .andExpect(jsonPath("notes").value("Dolor de espalda"))
                .andExpect(jsonPath("evaluated").value(false))
                .andExpect(jsonPath("startDateTime").value(slot.getStartDateTime().format(QUERY_DATE_FORMAT)));

        mvc.perform(bookingRequest(submitSelfEvaluation(1, 1, 1), slot.getId()).with(as(admin)))
                .andExpect(status().isBadRequest());
        mvc.perform(bookingRequest(selfEvaluationId, otherSlot.getId()).with(as(admin)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("message").value("Este colaborador ya tiene una cita pendiente."));
    }

    @Test
    void cancellationFreesTheSlotAndIsRecorded() throws Exception {
        long selfEvaluationId = submitSelfEvaluation(3, 3, 3);
        Availability slot = persistAvailability(ergonomist, futureAt(9, 8), futureAt(9, 9));
        long appointmentId = idOf(mvc.perform(bookingRequest(selfEvaluationId, slot.getId()).with(as(admin)))
                .andExpect(status().isCreated()).andReturn());

        mvc.perform(withRange(get("/api/appointments/availabilities"), ergonomist.getId()).with(as(ergonomist)))
                .andExpect(jsonPath("$.length()").value(0));
        mvc.perform(patch("/api/appointments/{id}/cancel", appointmentId).with(as(otherErgonomist)))
                .andExpect(status().isForbidden());
        mvc.perform(patch("/api/appointments/{id}/cancel", appointmentId).with(as(ergonomist)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("status").value("CANCELLED"));
        mvc.perform(patch("/api/appointments/{id}/cancel", appointmentId).with(as(ergonomist)))
                .andExpect(status().isBadRequest());
        mvc.perform(patch("/api/appointments/{id}/cancel", 999_999).with(as(admin))).andExpect(status().isNotFound());

        mvc.perform(withRange(get("/api/appointments/availabilities"), ergonomist.getId()).with(as(ergonomist)))
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").value(slot.getId()))
                .andExpect(jsonPath("$[0].taken").value(false));
        mvc.perform(get("/api/histories/employees/{email}", "ANA.MORA@flujo.test").with(as(ergonomist)))
                .andExpect(jsonPath("$[0].description").value("Cita cancelada."))
                .andExpect(jsonPath("$[0].type").value("APPOINTMENT_CANCELLED"));

        // The employee can book again once the previous appointment is cancelled,
        // and a freed slot that is used by a cancelled appointment can be deleted.
        long rebooked = idOf(mvc.perform(bookingRequest(selfEvaluationId, slot.getId()).with(as(admin)))
                .andExpect(status().isCreated()).andReturn());
        mvc.perform(patch("/api/appointments/{id}/cancel", rebooked).with(as(admin))).andExpect(status().isOk());
        mvc.perform(delete("/api/appointments/availabilities/{id}", slot.getId()).with(as(ergonomist)))
                .andExpect(status().isNoContent());
    }

    @Test
    void rescheduleMovesAppointmentAndUpdatesAvailabilities() throws Exception {
        long selfEvaluationId = submitSelfEvaluation(3, 3, 3);
        Availability originalSlot = persistAvailability(ergonomist, futureAt(10, 8), futureAt(10, 9));
        Availability newSlot = persistAvailability(ergonomist, futureAt(10, 10), futureAt(10, 11));

        long appointmentId = idOf(mvc.perform(
                        bookingRequest(selfEvaluationId, originalSlot.getId()).with(as(ergonomist)))
                .andExpect(status().isCreated())
                .andReturn());

        mvc.perform(rescheduleRequest(appointmentId, newSlot.getId()).with(as(ergonomist)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("id").value(appointmentId))
                .andExpect(jsonPath("status").value("SCHEDULED"))
                .andExpect(jsonPath("startDateTime").value(
                        newSlot.getStartDateTime().format(QUERY_DATE_FORMAT)))
                .andExpect(jsonPath("endDateTime").value(
                        newSlot.getEndDateTime().format(QUERY_DATE_FORMAT)));

        Availability updatedOriginal = availabilityRepository.findById(originalSlot.getId()).orElseThrow();
        Availability updatedNew = availabilityRepository.findById(newSlot.getId()).orElseThrow();

        assertThat(updatedOriginal.isTaken()).isFalse();
        assertThat(updatedNew.isTaken()).isTrue();

        mvc.perform(get("/api/histories/employees/{email}", "ANA.MORA@flujo.test").with(as(ergonomist)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].type").value("APPOINTMENT_RESCHEDULED"))
                .andExpect(jsonPath("$[0].description")
                        .value(org.hamcrest.Matchers.startsWith("Cita reprogramada para el ")));
    }

    @Test
    void rescheduleRejectsMissingAvailabilityId() throws Exception {
        long selfEvaluationId = submitSelfEvaluation(3, 3, 3);
        Availability slot = persistAvailability(ergonomist, futureAt(11, 8), futureAt(11, 9));

        long appointmentId = idOf(mvc.perform(
                        bookingRequest(selfEvaluationId, slot.getId()).with(as(ergonomist)))
                .andExpect(status().isCreated())
                .andReturn());

        mvc.perform(rescheduleRequest(appointmentId, null).with(as(ergonomist)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("fieldErrors.availabilityId")
                        .value("Este campo es obligatorio."));
    }

    @Test
    void rescheduleRejectsAnotherErgonomist() throws Exception {
        long selfEvaluationId = submitSelfEvaluation(3, 3, 3);
        Availability originalSlot = persistAvailability(ergonomist, futureAt(12, 8), futureAt(12, 9));
        Availability newSlot = persistAvailability(ergonomist, futureAt(12, 10), futureAt(12, 11));

        long appointmentId = idOf(mvc.perform(
                        bookingRequest(selfEvaluationId, originalSlot.getId()).with(as(ergonomist)))
                .andExpect(status().isCreated())
                .andReturn());

        mvc.perform(rescheduleRequest(appointmentId, newSlot.getId()).with(as(otherErgonomist)))
                .andExpect(status().isForbidden());
    }

    @Test
    void rescheduleRequiresAuthentication() throws Exception {
        long selfEvaluationId = submitSelfEvaluation(3, 3, 3);
        Availability originalSlot = persistAvailability(ergonomist, futureAt(13, 8), futureAt(13, 9));
        Availability newSlot = persistAvailability(ergonomist, futureAt(13, 10), futureAt(13, 11));

        long appointmentId = idOf(mvc.perform(
                        bookingRequest(selfEvaluationId, originalSlot.getId()).with(as(ergonomist)))
                .andExpect(status().isCreated())
                .andReturn());

        mvc.perform(rescheduleRequest(appointmentId, newSlot.getId()))
                .andExpect(status().isUnauthorized());
      }

    @Test
    void inactiveCompanyCannotBeUsedButKeepsItsHistory() throws Exception {
        long selfEvaluationId = submitSelfEvaluation(3, 3, 3);
        Availability slot = persistAvailability(ergonomist, futureAt(10, 8), futureAt(10, 9));
        Availability otherSlot = persistAvailability(ergonomist, futureAt(10, 10), futureAt(10, 11));
        long appointmentId = idOf(mvc.perform(bookingRequest(selfEvaluationId, slot.getId()).with(as(admin)))
                .andExpect(status().isCreated()).andReturn());

        mvc.perform(delete("/api/companies/{id}", company.getId()).with(as(admin)))
                .andExpect(status().isNoContent());

        mvc.perform(evaluationRequest(appointmentId).with(as(ergonomist)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("message").value("La empresa está inactiva. No se pueden registrar evaluaciones."));
        mvc.perform(patch("/api/appointments/{id}/cancel", appointmentId).with(as(admin)))
                .andExpect(status().isOk());
        mvc.perform(bookingRequest(selfEvaluationId, otherSlot.getId()).with(as(admin)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("message").value("La empresa está inactiva. No se pueden agendar citas."));

        // The profile is not deleted: it is still listed and its history can be read.
        mvc.perform(get("/api/companies/{id}", company.getId()).with(as(admin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("active").value(false));
        mvc.perform(get("/api/histories").param("companyId", String.valueOf(company.getId())).with(as(admin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(3));
    }

    @Test
    void agendaIsRestrictedToItsOwner() throws Exception {
        long selfEvaluationId = submitSelfEvaluation(1, 2, 3);
        Availability slot = persistAvailability(ergonomist, futureAt(14, 8), futureAt(14, 9));
        mvc.perform(bookingRequest(selfEvaluationId, slot.getId()).with(as(admin))).andExpect(status().isCreated());

        mvc.perform(withRange(get("/api/appointments"), ergonomist.getId()).with(as(ergonomist)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].companyName").value("Flujo S.A."));
        mvc.perform(withRange(get("/api/appointments"), ergonomist.getId()).with(as(admin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1));
        mvc.perform(withRange(get("/api/appointments"), ergonomist.getId()).with(as(otherErgonomist)))
                .andExpect(status().isForbidden());
        mvc.perform(withRange(get("/api/appointments"), ergonomist.getId())).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/appointments").with(as(admin))).andExpect(status().isBadRequest());
    }

    // ----- personalized evaluations -----

    @Test
    void thePersonalizedEvaluationNeedsADiagnosisAndARecommendationForEveryQuestion() throws Exception {
        long appointmentId = bookAppointment(20);

        Map<String, Object> missing = evaluationBody(appointmentId);
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> missingAnswers = (List<Map<String, Object>>) missing.get("answerList");
        missingAnswers.remove(1);
        mvc.perform(evaluationRequest(missing).with(as(ergonomist)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("message").value("Complete el diagnóstico y la recomendación de todas las preguntas."));

        Map<String, Object> foreign = evaluationBody(appointmentId);
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> foreignAnswers = (List<Map<String, Object>>) foreign.get("answerList");
        foreignAnswers.set(1, personalizedAnswer(questions.get(0), "Diagnóstico", "Recomendación"));
        mvc.perform(evaluationRequest(foreign).with(as(ergonomist)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("message").value("Complete el diagnóstico y la recomendación de todas las preguntas."));

        Map<String, Object> blank = evaluationBody(appointmentId);
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> blankAnswers = (List<Map<String, Object>>) blank.get("answerList");
        blankAnswers.set(0, personalizedAnswer(personalizedQuestions.get(0), "  ", null));
        blank.remove("formId");
        mvc.perform(evaluationRequest(blank).with(as(ergonomist)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("fieldErrors['answerList[0].diagnosis']").value("Este campo es obligatorio."))
                .andExpect(jsonPath("fieldErrors['answerList[0].recommendation']").value("Este campo es obligatorio."))
                .andExpect(jsonPath("fieldErrors.formId").value("Este campo es obligatorio."));

        // Nothing was stored and the appointment is still pending.
        mvc.perform(withRange(get("/api/appointments"), ergonomist.getId()).with(as(ergonomist)))
                .andExpect(jsonPath("$[0].status").value("SCHEDULED"));
    }

    @Test
    void thePersonalizedEvaluationUsesTheActivePersonalizedForm() throws Exception {
        long appointmentId = bookAppointment(21);

        Map<String, Object> selfEvaluationForm = evaluationBody(appointmentId);
        selfEvaluationForm.put("formId", form.getId());
        mvc.perform(evaluationRequest(selfEvaluationForm).with(as(ergonomist)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("message").value("El formulario seleccionado no es una evaluación personalizada."));

        Map<String, Object> unknownForm = evaluationBody(appointmentId);
        unknownForm.put("formId", 999_999L);
        mvc.perform(evaluationRequest(unknownForm).with(as(ergonomist)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("message").value("El formulario seleccionado no existe."));

        personalizedForm.setActive(false);
        formRepository.flush();
        mvc.perform(evaluationRequest(appointmentId).with(as(ergonomist)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("message").value("El formulario seleccionado no está activo."));
    }

    @Test
    void keepsTheQuestionAsItWasWhenThePersonalizedFormIsEditedLater() throws Exception {
        long appointmentId = bookAppointment(22);
        long evaluationId = idOf(mvc.perform(evaluationRequest(appointmentId).with(as(ergonomist)))
                .andExpect(status().isCreated()).andReturn());

        Question edited = personalizedQuestions.get(0);
        edited.setStatement("Texto editado");
        edited.setQuestionOrder(5);
        questionRepository.flush();

        mvc.perform(get("/api/personalized-evaluations/{id}", evaluationId).with(as(ergonomist)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("answerList[0].statement").value("Postura frente a la pantalla"))
                .andExpect(jsonPath("answerList[0].questionOrder").value(1));
    }

    // ----- full flow -----

    @Test
    void fullFlowFromSelfEvaluationToPdfReport() throws Exception {
        long selfEvaluationId = submitSelfEvaluation(3, 3, 2);

        LocalDateTime start = futureAt(16, 9);
        long slotId = idOf(mvc.perform(availabilityRequest(ergonomist.getId(), start, start.plusHours(1))
                        .with(as(ergonomist)))
                .andExpect(status().isCreated()).andReturn());
        long appointmentId = idOf(mvc.perform(bookingRequest(selfEvaluationId, slotId).with(as(admin)))
                .andExpect(status().isCreated()).andReturn());

        // Only the ergonomist of the appointment writes the evaluation.
        mvc.perform(evaluationRequest(appointmentId).with(as(admin))).andExpect(status().isForbidden());
        mvc.perform(evaluationRequest(appointmentId).with(as(otherErgonomist))).andExpect(status().isForbidden());
        mvc.perform(evaluationRequest(appointmentId)).andExpect(status().isUnauthorized());

        MvcResult created = mvc.perform(evaluationRequest(appointmentId).with(as(ergonomist)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("appointmentId").value(appointmentId))
                .andExpect(jsonPath("userId").value(ergonomist.getId()))
                .andExpect(jsonPath("riskLevel").doesNotExist())
                .andExpect(jsonPath("formId").value(personalizedForm.getId()))
                .andExpect(jsonPath("formTitle").value("Entrevista ergonómica"))
                .andExpect(jsonPath("answerList.length()").value(2))
                .andExpect(jsonPath("answerList[0].questionOrder").value(1))
                .andExpect(jsonPath("answerList[0].statement").value("Postura frente a la pantalla"))
                .andExpect(jsonPath("answerList[0].diagnosis").value("Postura encorvada frente al monitor."))
                .andExpect(jsonPath("answerList[1].recommendation").value("Acercar el teclado y usar reposamuñecas."))
                .andExpect(jsonPath("employeeName").value("Ana Mora"))
                .andExpect(jsonPath("employeeEmail").value("ana.mora@flujo.test"))
                .andExpect(jsonPath("companyName").value("Flujo S.A."))
                .andReturn();
        long evaluationId = idOf(created);
        assertThat((String) read(created, "$.reportPath"))
                .isEqualTo("/api/personalized-evaluations/" + evaluationId + "/report");

        mvc.perform(evaluationRequest(appointmentId).with(as(ergonomist)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("message").value("Esta cita ya tiene una evaluación."));

        mvc.perform(withRange(get("/api/appointments"), ergonomist.getId()).with(as(ergonomist)))
                .andExpect(jsonPath("$[0].status").value("COMPLETED"))
                .andExpect(jsonPath("$[0].evaluated").value(true));
        mvc.perform(patch("/api/appointments/{id}/cancel", appointmentId).with(as(ergonomist)))
                .andExpect(status().isBadRequest());

        // Reading: admin any, ergonomist only their own; the list is for ergonomists.
        mvc.perform(get("/api/personalized-evaluations/{id}", evaluationId).with(as(admin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("answerList[0].diagnosis").value("Postura encorvada frente al monitor."));
        mvc.perform(get("/api/personalized-evaluations/{id}", evaluationId).with(as(ergonomist)))
                .andExpect(status().isOk());
        mvc.perform(get("/api/personalized-evaluations/{id}", evaluationId).with(as(otherErgonomist)))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/personalized-evaluations/{id}", 999_999).with(as(admin)))
                .andExpect(status().isNotFound());
        mvc.perform(get("/api/personalized-evaluations").param("userId", String.valueOf(ergonomist.getId()))
                        .with(as(ergonomist)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").value(evaluationId))
                .andExpect(jsonPath("$[0].answerList.length()").value(2));
        mvc.perform(get("/api/personalized-evaluations").param("userId", String.valueOf(ergonomist.getId()))
                        .with(as(otherErgonomist)))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/personalized-evaluations").param("userId", String.valueOf(ergonomist.getId()))
                        .with(as(admin)))
                .andExpect(status().isForbidden());

        // PDF report.
        for (User reader : List.of(admin, ergonomist)) {
            MvcResult report = mvc.perform(get("/api/personalized-evaluations/{id}/report", evaluationId)
                            .with(as(reader)))
                    .andExpect(status().isOk())
                    .andExpect(content().contentType(MediaType.APPLICATION_PDF))
                    .andReturn();
            byte[] pdf = report.getResponse().getContentAsByteArray();
            assertThat(pdf.length).isGreaterThan(500);
            assertThat(new String(pdf, 0, 4, StandardCharsets.US_ASCII)).isEqualTo("%PDF");
            String text = new PdfTextExtractor(new PdfReader(pdf)).getTextFromPage(1);
            assertThat(text)
                    .contains("Entrevista ergonómica")
                    .contains("1. Postura frente a la pantalla")
                    .contains("Diagnóstico: Postura encorvada frente al monitor.")
                    .contains("Recomendación: Acercar el teclado y usar reposamuñecas.")
                    .doesNotContain("Nivel de riesgo");
            assertThat(report.getResponse().getHeader("Content-Disposition"))
                    .contains("personalized-evaluation-" + evaluationId + ".pdf");
        }
        mvc.perform(get("/api/personalized-evaluations/{id}/report", evaluationId).with(as(otherErgonomist)))
                .andExpect(status().isForbidden());

        // History: newest first, both by company and by employee.
        mvc.perform(get("/api/histories/employees/{email}", " Ana.Mora@Flujo.test ").with(as(ergonomist)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(3))
                .andExpect(jsonPath("$[0].description").value("Evaluación personalizada \"Entrevista ergonómica\" registrada."))
                .andExpect(jsonPath("$[0].personalizedEvaluationId").value(evaluationId))
                .andExpect(jsonPath("$[0].selfEvaluationId").value(selfEvaluationId))
                .andExpect(jsonPath("$[0].type").value("PERSONALIZED_EVALUATION"))
                .andExpect(jsonPath("$[1].type").value("APPOINTMENT_BOOKED"))
                .andExpect(jsonPath("$[2].type").value("SELF_EVALUATION"))
                .andExpect(jsonPath("$[1].description").value(org.hamcrest.Matchers.startsWith("Cita agendada para el ")))
                .andExpect(jsonPath("$[1].description").value(org.hamcrest.Matchers.endsWith(" con Nombre Ergo.")))
                .andExpect(jsonPath("$[2].description")
                        .value("Autoevaluación \"Postura\" enviada. Riesgo Alto (83 %)."));
        mvc.perform(get("/api/histories").param("companyId", String.valueOf(company.getId())).with(as(admin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(3))
                .andExpect(jsonPath("$[0].companyName").value("Flujo S.A."));
        mvc.perform(get("/api/histories").param("companyId", String.valueOf(company.getId())))
                .andExpect(status().isUnauthorized());
    }

    // ----- dashboard -----

    @Test
    void dashboardCountsUpcomingAppointmentsAndActiveRecords() throws Exception {
        MvcResult before = mvc.perform(get("/api/dashboard/summary").with(as(admin)))
                .andExpect(status().isOk()).andReturn();
        int appointments = read(before, "$.scheduledAppointments");
        int companies = read(before, "$.activeCompanies");
        int users = read(before, "$.activeUsers");
        int forms = read(before, "$.activeForms");

        persistCompany("Nueva activa", "3-101-000300", true);
        persistCompany("Nueva inactiva", "3-101-000301", false);
        persistForm("Otro formulario", 1);
        User inactiveUser = persistUser("inactivo.flow@example.test", Role.ERGONOMIST);
        inactiveUser.setActive(false);
        persistUser("activo.flow@example.test", Role.ERGONOMIST);
        userRepository.flush();

        long selfEvaluationId = submitSelfEvaluation(1, 1, 1);
        Availability slot = persistAvailability(ergonomist, futureAt(18, 8), futureAt(18, 9));
        mvc.perform(bookingRequest(selfEvaluationId, slot.getId()).with(as(admin))).andExpect(status().isCreated());
        long cancelledSelfEvaluation = submitSelfEvaluation(1, 1, 1);
        Availability otherSlot = persistAvailability(ergonomist, futureAt(18, 10), futureAt(18, 11));
        long cancelled = idOf(mvc.perform(bookingRequest(cancelledSelfEvaluation, otherSlot.getId()).with(as(admin)))
                .andExpect(status().isCreated()).andReturn());
        mvc.perform(patch("/api/appointments/{id}/cancel", cancelled).with(as(admin))).andExpect(status().isOk());

        mvc.perform(get("/api/dashboard/summary").with(as(admin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("scheduledAppointments").value(appointments + 1))
                .andExpect(jsonPath("activeCompanies").value(companies + 1))
                .andExpect(jsonPath("activeUsers").value(users + 1))
                .andExpect(jsonPath("activeForms").value(forms + 1));
        mvc.perform(get("/api/dashboard/summary").with(as(ergonomist))).andExpect(status().isForbidden());
        mvc.perform(get("/api/dashboard/summary")).andExpect(status().isUnauthorized());
    }
}