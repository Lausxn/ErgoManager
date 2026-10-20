package com.mgs.ergomanager.api;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.mgs.ergomanager.model.Company;
import com.mgs.ergomanager.model.Form;
import com.mgs.ergomanager.model.SelfEvaluation;
import com.mgs.ergomanager.model.User;
import com.mgs.ergomanager.model.enums.Role;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

/** The reports of a client stay reachable after the client is renamed. */
class CompanyRenameReportsIntegrationTests extends ApiIntegrationTestSupport {

    private User admin;
    private Company company;
    private SelfEvaluation selfEvaluation;

    @BeforeEach
    void createEvaluatedClient() {
        admin = persistUser("admin.rename@example.test", Role.ADMIN);
        Form form = persistForm("Autoevaluación 2026", 1);
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
}
