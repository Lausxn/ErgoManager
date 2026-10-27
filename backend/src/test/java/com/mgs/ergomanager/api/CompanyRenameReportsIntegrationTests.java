package com.mgs.ergomanager.api;

import static org.hamcrest.Matchers.contains;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.mgs.ergomanager.hu.UserStories;
import com.mgs.ergomanager.model.Appointment;
import com.mgs.ergomanager.model.Company;
import com.mgs.ergomanager.model.Form;
import com.mgs.ergomanager.model.PersonalizedEvaluation;
import com.mgs.ergomanager.model.SelfEvaluation;
import com.mgs.ergomanager.model.User;
import com.mgs.ergomanager.model.enums.AppointmentStatus;
import com.mgs.ergomanager.model.enums.Role;
import com.mgs.ergomanager.repository.AppointmentRepository;
import com.mgs.ergomanager.repository.PersonalizedEvaluationRepository;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;

/** The reports of a client stay reachable after the client is renamed. */
@Tag(UserStories.HU_020)
class CompanyRenameReportsIntegrationTests extends ApiIntegrationTestSupport {

    @Autowired
    private AppointmentRepository appointmentRepository;

    @Autowired
    private PersonalizedEvaluationRepository personalizedEvaluationRepository;

    private User admin;
    private Form form;
    private Company company;
    private SelfEvaluation selfEvaluation;

    @BeforeEach
    void createEvaluatedClient() {
        admin = persistUser("admin.rename@example.test", Role.ADMIN);
        form = persistForm("Autoevaluación 2026", 1);
        company = persistCompany("Coca-Cola", "3-101-700100", true);
        selfEvaluation = persistSelfEvaluation(form, company, "ana@coca.test");
    }

    private void rename(String newName) throws Exception {
        mvc.perform(put("/api/companies/{id}", company.getId()).with(as(admin))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(toJson(Map.of("businessName", newName, "taxId", company.getTaxId(),
                                "contactEmail", company.getContactEmail()))))
                .andExpect(status().isOk());
    }

    @Test
    void reportsMadeBeforeTheRenameAppearUnderTheNewName() throws Exception {
        rename("Coca-Cola FEMSA");

        mvc.perform(get("/api/reports/evaluations").with(as(admin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].evaluationId").value(selfEvaluation.getId()))
                .andExpect(jsonPath("$[0].companyId").value(company.getId()))
                .andExpect(jsonPath("$[0].companyName").value("Coca-Cola FEMSA"));
    }

    @Test
    void theNewNameFindsTheReportsMadeBeforeTheRename() throws Exception {
        rename("Coca-Cola FEMSA");

        mvc.perform(get("/api/reports/evaluations").param("companyName", "femsa").with(as(admin)))
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].evaluationId").value(selfEvaluation.getId()));
        mvc.perform(get("/api/reports/companies").with(as(admin)))
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].businessName").value("Coca-Cola FEMSA"));
        mvc.perform(get("/api/reports/employees").param("companyId", String.valueOf(company.getId())).with(as(admin)))
                .andExpect(jsonPath("$[0].employeeEmail").value("ana@coca.test"))
                .andExpect(jsonPath("$[0].companyName").value("Coca-Cola FEMSA"));
    }

    private PersonalizedEvaluation persistPersonalizedEvaluation(SelfEvaluation evaluated) {
        User ergonomist = persistUser("ergo.rename@example.test", Role.ERGONOMIST);
        Appointment appointment = new Appointment();
        appointment.setSelfEvaluation(evaluated);
        appointment.setUser(ergonomist);
        appointment.setStartDateTime(futureAt(1, 8));
        appointment.setEndDateTime(futureAt(1, 9));
        appointment.setStatus(AppointmentStatus.COMPLETED);
        appointmentRepository.saveAndFlush(appointment);
        PersonalizedEvaluation evaluation = new PersonalizedEvaluation();
        evaluation.setAppointment(appointment);
        evaluation.setUser(ergonomist);
        return personalizedEvaluationRepository.saveAndFlush(evaluation);
    }

    @Test
    void thePreviousNameStillFindsBothKindsOfReportsShownUnderTheNewName() throws Exception {
        PersonalizedEvaluation personalized = persistPersonalizedEvaluation(selfEvaluation);
        rename("Coca-Cola FEMSA");

        mvc.perform(get("/api/reports/evaluations").param("companyName", "Coca-Cola").with(as(admin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[*].companyName", contains("Coca-Cola FEMSA", "Coca-Cola FEMSA")))
                .andExpect(jsonPath("$[0].previousCompanyNames", contains("Coca-Cola")))
                .andExpect(jsonPath("$[1].previousCompanyNames", contains("Coca-Cola")));
        mvc.perform(get("/api/reports/evaluations").param("companyName", "Coca-Cola")
                        .param("type", "PERSONALIZED_EVALUATION").with(as(admin)))
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].evaluationId").value(personalized.getId()));
    }

    @Test
    void anyPreviousNameMatchesIgnoringCaseAccentsAndOnlyPartOfIt() throws Exception {
        rename("Bebidas del Valle");
        rename("Refrescos Centroamérica");

        for (String filter : new String[] {"coca", "BEBIDAS", "del valle", "centroamerica", "refrescos"}) {
            mvc.perform(get("/api/reports/evaluations").param("companyName", filter).with(as(admin)))
                    .andExpect(jsonPath("$.length()").value(1))
                    .andExpect(jsonPath("$[0].companyName").value("Refrescos Centroamérica"))
                    .andExpect(jsonPath("$[0].previousCompanyNames", contains("Bebidas del Valle", "Coca-Cola")));
        }
    }

    @Test
    void thePreviousNamesOfAClientDoNotBringOtherClients() throws Exception {
        Company pepsi = persistCompany("Pepsi", "3-101-700101", true);
        persistSelfEvaluation(form, pepsi, "luis@pepsi.test");
        rename("Coca-Cola FEMSA");

        mvc.perform(get("/api/reports/evaluations").param("companyName", "coca").with(as(admin)))
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].employeeEmail").value("ana@coca.test"));
        mvc.perform(get("/api/reports/evaluations").param("companyName", "pepsi").with(as(admin)))
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].previousCompanyNames").isEmpty());
    }

    @Test
    void theCompanyFilterOptionsShowThePreviousNames() throws Exception {
        rename("Coca-Cola FEMSA");

        mvc.perform(get("/api/reports/companies").with(as(admin)))
                .andExpect(jsonPath("$[0].businessName").value("Coca-Cola FEMSA"))
                .andExpect(jsonPath("$[0].previousNames", contains("Coca-Cola")));
    }
}
