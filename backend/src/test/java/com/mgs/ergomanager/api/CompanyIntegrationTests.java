package com.mgs.ergomanager.api;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.mgs.ergomanager.model.Company;
import com.mgs.ergomanager.model.User;
import com.mgs.ergomanager.model.enums.Role;
import java.util.HashMap;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;

/** Management of client companies and its role restrictions. */
class CompanyIntegrationTests extends ApiIntegrationTestSupport {

    private User admin;
    private User ergonomist;

    @BeforeEach
    void createUsers() {
        admin = persistUser("admin.companies@example.test", Role.ADMIN);
        ergonomist = persistUser("ergo.companies@example.test", Role.ERGONOMIST);
    }

    private static Map<String, Object> body(String name, String taxId) {
        Map<String, Object> body = new HashMap<>();
        body.put("businessName", "  " + name + "  ");
        body.put("taxId", " " + taxId + " ");
        body.put("contactEmail", " RRHH@Empresa.TEST ");
        body.put("phoneNumber", "   ");
        body.put("address", " San José ");
        return body;
    }

    private long create(String name, String taxId) throws Exception {
        MvcResult result = mvc.perform(post("/api/companies").with(as(admin))
                        .contentType(MediaType.APPLICATION_JSON).content(toJson(body(name, taxId))))
                .andExpect(status().isCreated())
                .andReturn();
        return idOf(result);
    }

    @Test
    void createsNormalizedCompany() throws Exception {
        mvc.perform(post("/api/companies").with(as(admin))
                        .contentType(MediaType.APPLICATION_JSON).content(toJson(body("Acme", "3-101-000001"))))
                .andExpect(status().isCreated())
                .andExpect(header().exists("Location"))
                .andExpect(jsonPath("businessName").value("Acme"))
                .andExpect(jsonPath("taxId").value("3-101-000001"))
                .andExpect(jsonPath("contactEmail").value("rrhh@empresa.test"))
                .andExpect(jsonPath("phoneNumber").doesNotExist())
                .andExpect(jsonPath("address").value("San José"))
                .andExpect(jsonPath("active").value(true));
    }

    @Test
    void listsByBusinessNameAndReadsById() throws Exception {
        long zeta = create("Zeta", "3-101-000002");
        create("Alfa", "3-101-000003");
        mvc.perform(get("/api/companies").with(as(admin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].businessName").value("Alfa"))
                .andExpect(jsonPath("$[1].businessName").value("Zeta"));
        mvc.perform(get("/api/companies/{id}", zeta).with(as(admin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("taxId").value("3-101-000002"));
        mvc.perform(get("/api/companies/{id}", 999_999).with(as(admin)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("message").value("No se encontró la empresa."));
    }

    @Test
    void rejectsDuplicatedTaxIdOnCreateAndUpdate() throws Exception {
        create("Primera", "3-101-000004");
        long second = create("Segunda", "3-101-000005");
        mvc.perform(post("/api/companies").with(as(admin))
                        .contentType(MediaType.APPLICATION_JSON).content(toJson(body("Otra", "3-101-000004"))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("message").value("Ya existe una empresa con esa cédula jurídica."));
        mvc.perform(put("/api/companies/{id}", second).with(as(admin))
                        .contentType(MediaType.APPLICATION_JSON).content(toJson(body("Segunda", "3-101-000004"))))
                .andExpect(status().isConflict());
        // Keeping its own tax id is not a conflict.
        mvc.perform(put("/api/companies/{id}", second).with(as(admin))
                        .contentType(MediaType.APPLICATION_JSON).content(toJson(body("Segunda S.A.", "3-101-000005"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("businessName").value("Segunda S.A."));
    }

    @Test
    void returnsSpanishValidationMessages() throws Exception {
        Map<String, Object> invalid = body("", "3-101-000000000000000000");
        invalid.put("contactEmail", "no-es-correo");
        mvc.perform(post("/api/companies").with(as(admin))
                        .contentType(MediaType.APPLICATION_JSON).content(toJson(invalid)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("fieldErrors.businessName").value("Este campo es obligatorio."))
                .andExpect(jsonPath("fieldErrors.taxId").value("Use un máximo de 20 caracteres."))
                .andExpect(jsonPath("fieldErrors.contactEmail").value("Escriba un correo válido."));
    }

    @Test
    void deactivatesAndActivates() throws Exception {
        Company company = persistCompany("Activa", "3-101-000006", true);
        mvc.perform(delete("/api/companies/{id}", company.getId()).with(as(admin)))
                .andExpect(status().isNoContent());
        mvc.perform(get("/api/companies/{id}", company.getId()).with(as(admin)))
                .andExpect(jsonPath("active").value(false));
        mvc.perform(patch("/api/companies/{id}/activate", company.getId()).with(as(admin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("active").value(true));
    }

    @Test
    void ergonomistOnlyReadsCompanies() throws Exception {
        Company company = persistCompany("Lectura", "3-101-000007", true);
        mvc.perform(get("/api/companies").with(as(ergonomist))).andExpect(status().isOk());
        mvc.perform(get("/api/companies/{id}", company.getId()).with(as(ergonomist))).andExpect(status().isOk());
        mvc.perform(post("/api/companies").with(as(ergonomist))
                        .contentType(MediaType.APPLICATION_JSON).content(toJson(body("X", "3-101-000008"))))
                .andExpect(status().isForbidden());
        mvc.perform(put("/api/companies/{id}", company.getId()).with(as(ergonomist))
                        .contentType(MediaType.APPLICATION_JSON).content(toJson(body("X", "3-101-000007"))))
                .andExpect(status().isForbidden());
        mvc.perform(delete("/api/companies/{id}", company.getId()).with(as(ergonomist)))
                .andExpect(status().isForbidden());
        mvc.perform(patch("/api/companies/{id}/activate", company.getId()).with(as(ergonomist)))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/companies")).andExpect(status().isUnauthorized());
    }
}
