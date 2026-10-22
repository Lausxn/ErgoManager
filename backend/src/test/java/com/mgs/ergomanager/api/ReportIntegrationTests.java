package com.mgs.ergomanager.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.mgs.ergomanager.model.Appointment;
import com.mgs.ergomanager.model.Company;
import com.mgs.ergomanager.model.Form;
import com.mgs.ergomanager.model.PersonalizedEvaluation;
import com.mgs.ergomanager.model.SelfEvaluation;
import com.mgs.ergomanager.model.User;
import com.mgs.ergomanager.model.enums.AppointmentStatus;
import com.mgs.ergomanager.model.enums.RiskLevel;
import com.mgs.ergomanager.model.enums.Role;
import com.mgs.ergomanager.repository.AppointmentRepository;
import com.mgs.ergomanager.repository.PersonalizedEvaluationRepository;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.web.servlet.MvcResult;

/** Evaluation reports filtered by company and employee and sorted alphabetically. */
class ReportIntegrationTests extends ApiIntegrationTestSupport {

    @Autowired
    private AppointmentRepository appointmentRepository;

    @Autowired
    private PersonalizedEvaluationRepository personalizedEvaluationRepository;

    private User admin;
    private User ergonomist;
    private User otherErgonomist;
    private Form form;
    private Company acme;
    private Company nandu;
    private Company zeta;
    private SelfEvaluation anaAcme;

    @BeforeEach
    void createData() {
        admin = persistUser("admin.reports@example.test", Role.ADMIN);
        ergonomist = persistUser("ergo.reports@example.test", Role.ERGONOMIST);
        otherErgonomist = persistUser("otro.reports@example.test", Role.ERGONOMIST);
        form = persistForm("Autoevaluación 2026", 1);
        zeta = persistCompany("Zeta S.A.", "3-101-000301", true);
        nandu = persistCompany("Ñandú Servicios", "3-101-000302", false);
        acme = persistCompany("acme Ltda", "3-101-000303", true);

        selfEvaluation(zeta, "Ana Zeledón", "ana@zeta.test", RiskLevel.HIGH);
        selfEvaluation(nandu, "Carlos Núñez", "carlos@nandu.test", RiskLevel.MEDIUM);
        selfEvaluation(acme, "Beatriz Solís", "beatriz@acme.test", RiskLevel.LOW);
        anaAcme = selfEvaluation(acme, "ana Álvarez", "ana@acme.test", RiskLevel.MEDIUM);
    }

    private SelfEvaluation selfEvaluation(Company company, String name, String email, RiskLevel risk) {
        SelfEvaluation selfEvaluation = persistSelfEvaluation(form, company, email);
        selfEvaluation.setEmployeeName(name);
        selfEvaluation.setEmployeePosition("Digitador");
        selfEvaluation.setRiskLevel(risk);
        selfEvaluation.setRiskPercentage(50.0);
        return selfEvaluationRepository.saveAndFlush(selfEvaluation);
    }

    private PersonalizedEvaluation personalizedEvaluation(SelfEvaluation selfEvaluation, User author) {
        Appointment appointment = new Appointment();
        appointment.setSelfEvaluation(selfEvaluation);
        appointment.setUser(author);
        appointment.setStartDateTime(futureAt(1, 8));
        appointment.setEndDateTime(futureAt(1, 9));
        appointment.setStatus(AppointmentStatus.COMPLETED);
        appointmentRepository.saveAndFlush(appointment);
        PersonalizedEvaluation evaluation = new PersonalizedEvaluation();
        evaluation.setAppointment(appointment);
        evaluation.setUser(author);
        personalizedEvaluationRepository.saveAndFlush(evaluation);
        evaluation.setReportPath("/api/personalized-evaluations/" + evaluation.getId() + "/report");
        return personalizedEvaluationRepository.saveAndFlush(evaluation);
    }

    @Test
    void listsBothTypesSortedByCompanyEmployeeNameAndEmail() throws Exception {
        PersonalizedEvaluation personalized = personalizedEvaluation(anaAcme, ergonomist);

        MvcResult result = mvc.perform(get("/api/reports/evaluations").with(as(admin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(5))
                // "acme" before "Ñandú" before "Zeta": case and accents are ignored.
                .andExpect(jsonPath("$[0].companyName").value("acme Ltda"))
                .andExpect(jsonPath("$[0].employeeName").value("ana Álvarez"))
                .andExpect(jsonPath("$[1].employeeName").value("ana Álvarez"))
                .andExpect(jsonPath("$[2].employeeName").value("Beatriz Solís"))
                .andExpect(jsonPath("$[3].companyName").value("Ñandú Servicios"))
                .andExpect(jsonPath("$[4].companyName").value("Zeta S.A."))
                .andReturn();

        List<String> types = read(result, "$[0:2].type");
        assertThat(types).containsExactlyInAnyOrder("SELF_EVALUATION", "PERSONALIZED_EVALUATION");

        mvc.perform(get("/api/reports/evaluations").param("type", "SELF_EVALUATION").with(as(admin)))
                .andExpect(jsonPath("$.length()").value(4))
                .andExpect(jsonPath("$[0].evaluationId").value(anaAcme.getId()))
                .andExpect(jsonPath("$[0].selfEvaluationId").value(anaAcme.getId()))
                .andExpect(jsonPath("$[0].employeeEmail").value("ana@acme.test"))
                .andExpect(jsonPath("$[0].employeePosition").value("Digitador"))
                .andExpect(jsonPath("$[0].formTitle").value("Autoevaluación 2026"))
                .andExpect(jsonPath("$[0].riskLevel").value("MEDIUM"))
                .andExpect(jsonPath("$[0].riskPercentage").value(50.0))
                .andExpect(jsonPath("$[0].ergonomistName").doesNotExist())
                .andExpect(jsonPath("$[0].detailPath").value("/api/self-evaluations/" + anaAcme.getId()))
                .andExpect(jsonPath("$[0].reportPath").doesNotExist());

        mvc.perform(get("/api/reports/evaluations").param("type", "PERSONALIZED_EVALUATION").with(as(admin)))
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].evaluationId").value(personalized.getId()))
                .andExpect(jsonPath("$[0].selfEvaluationId").value(anaAcme.getId()))
                .andExpect(jsonPath("$[0].riskLevel").doesNotExist())
                .andExpect(jsonPath("$[0].ergonomistName").value("Nombre Ergo"))
                .andExpect(jsonPath("$[0].detailPath").value("/api/personalized-evaluations/" + personalized.getId()))
                .andExpect(jsonPath("$[0].reportPath")
                        .value("/api/personalized-evaluations/" + personalized.getId() + "/report"));
    }

    @Test
    void filtersByCompanyNameAndEmailIgnoringCaseAndAccents() throws Exception {
        mvc.perform(get("/api/reports/evaluations").param("companyName", " NANDU ").with(as(admin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].employeeEmail").value("carlos@nandu.test"));

        mvc.perform(get("/api/reports/evaluations").param("employeeEmail", "ANA@").with(as(admin)))
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].employeeEmail").value("ana@acme.test"))
                .andExpect(jsonPath("$[1].employeeEmail").value("ana@zeta.test"));

        mvc.perform(get("/api/reports/evaluations")
                        .param("companyName", "acme").param("employeeEmail", "beatriz").with(as(admin)))
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].employeeName").value("Beatriz Solís"));

        mvc.perform(get("/api/reports/evaluations").param("companyName", "Inexistente").with(as(admin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void anErgonomistOnlySeesTheirOwnPersonalizedEvaluations() throws Exception {
        personalizedEvaluation(anaAcme, ergonomist);
        SelfEvaluation carlos = selfEvaluationRepository.findAll().stream()
                .filter(selfEvaluation -> selfEvaluation.getEmployeeEmail().equals("carlos@nandu.test"))
                .findFirst()
                .orElseThrow();
        personalizedEvaluation(carlos, otherErgonomist);

        mvc.perform(get("/api/reports/evaluations").param("type", "PERSONALIZED_EVALUATION").with(as(ergonomist)))
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].employeeEmail").value("ana@acme.test"));
        mvc.perform(get("/api/reports/evaluations").param("type", "PERSONALIZED_EVALUATION").with(as(admin)))
                .andExpect(jsonPath("$.length()").value(2));
        // Self evaluations are shared by both roles.
        mvc.perform(get("/api/reports/evaluations").param("type", "SELF_EVALUATION").with(as(otherErgonomist)))
                .andExpect(jsonPath("$.length()").value(4));
    }

    @Test
    void listsTheCompaniesAndEmployeesOfferedAsFilters() throws Exception {
        persistCompany("Sin evaluaciones", "3-101-000304", true);
        SelfEvaluation renamed = selfEvaluation(acme, "Ana Álvarez Mora", "ana@acme.test", RiskLevel.LOW);

        mvc.perform(get("/api/reports/companies").with(as(ergonomist)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(3))
                .andExpect(jsonPath("$[0].businessName").value("acme Ltda"))
                .andExpect(jsonPath("$[1].businessName").value("Ñandú Servicios"))
                .andExpect(jsonPath("$[1].active").value(false))
                .andExpect(jsonPath("$[2].businessName").value("Zeta S.A."));

        mvc.perform(get("/api/reports/employees").with(as(admin)))
                .andExpect(jsonPath("$.length()").value(4))
                .andExpect(jsonPath("$[0].employeeName").value(renamed.getEmployeeName()))
                .andExpect(jsonPath("$[1].employeeName").value("Ana Zeledón"))
                .andExpect(jsonPath("$[2].employeeName").value("Beatriz Solís"))
                .andExpect(jsonPath("$[3].employeeName").value("Carlos Núñez"));

        mvc.perform(get("/api/reports/employees").param("companyId", String.valueOf(acme.getId())).with(as(admin)))
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].employeeEmail").value("ana@acme.test"))
                .andExpect(jsonPath("$[0].companyName").value("acme Ltda"))
                .andExpect(jsonPath("$[1].employeeEmail").value("beatriz@acme.test"));
    }

    @Test
    void reportsRequireAStaffSessionAndAValidType() throws Exception {
        mvc.perform(get("/api/reports/evaluations")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/reports/companies")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/reports/employees")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/reports/evaluations").param("type", "OTRO").with(as(admin)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("message").value("El valor del parámetro type no es válido."));
    }
}
