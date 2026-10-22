package com.mgs.ergomanager.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.mgs.ergomanager.model.Company;
import com.mgs.ergomanager.model.User;
import com.mgs.ergomanager.model.enums.Role;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

/**
 * What creating and editing a client profile really writes to the database.
 * Every check reads the row again after clearing the persistence context.
 */
class CompanyPersistenceIntegrationTests extends ApiIntegrationTestSupport {

    @PersistenceContext
    private EntityManager entityManager;

    private User admin;

    @BeforeEach
    void createAdmin() {
        admin = persistUser("admin.persistence@example.test", Role.ADMIN);
    }

    private static Map<String, Object> body(String name, String taxId, String email, String phone, String address) {
        Map<String, Object> body = new HashMap<>();
        body.put("businessName", name);
        body.put("taxId", taxId);
        body.put("contactEmail", email);
        body.put("phoneNumber", phone);
        body.put("address", address);
        return body;
    }

    private MockHttpServletRequestBuilder json(MockHttpServletRequestBuilder request, Map<String, Object> body) {
        return request.with(as(admin)).contentType(MediaType.APPLICATION_JSON).content(toJson(body));
    }

    /** Reads the row from the database, not from the persistence context of the test. */
    private Company stored(long id) {
        entityManager.flush();
        entityManager.clear();
        return companyRepository.findById(id).orElseThrow();
    }

    private Company persistFullCompany() {
        Company company = persistCompany("Servicios del Valle", "3-101-300001", true);
        company.setPhoneNumber("2222-3333");
        company.setAddress("San José");
        return companyRepository.saveAndFlush(company);
    }

    @Test
    void createStoresEveryFieldNormalizedAndAnswersWithTheStoredRow() throws Exception {
        MvcResult result = mvc.perform(json(post("/api/companies"), body(
                        "  Servicios del Valle S.A. ", " 3-101-300002 ", " RRHH@Valle.Test ", " 2222-3333 ", " Heredia ")))
                .andExpect(status().isCreated())
                .andReturn();
        long id = idOf(result);

        Company company = stored(id);
        assertThat(company.getBusinessName()).isEqualTo("Servicios del Valle S.A.");
        assertThat(company.getTaxId()).isEqualTo("3-101-300002");
        assertThat(company.getContactEmail()).isEqualTo("rrhh@valle.test");
        assertThat(company.getPhoneNumber()).isEqualTo("2222-3333");
        assertThat(company.getAddress()).isEqualTo("Heredia");
        assertThat(company.isActive()).isTrue();
        assertThat(company.getCreatedAt()).isNotNull();
        assertThat(result.getResponse().getHeader("Location")).isEqualTo("/api/companies/" + id);
        assertThat(companyRepository.count()).isEqualTo(1);
    }

    @Test
    void createStoresBlankOptionalFieldsAsNull() throws Exception {
        Map<String, Object> request = body("Sin contacto", "3-101-300003", "contacto@sin.test", "   ", null);
        long id = idOf(mvc.perform(json(post("/api/companies"), request))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("phoneNumber").doesNotExist())
                .andExpect(jsonPath("address").doesNotExist())
                .andReturn());

        Company company = stored(id);
        assertThat(company.getPhoneNumber()).isNull();
        assertThat(company.getAddress()).isNull();
    }

    @Test
    void updateReplacesEveryEditableFieldAndKeepsIdentityStateAndCreationDate() throws Exception {
        Company original = persistFullCompany();
        LocalDateTime createdAt = stored(original.getId()).getCreatedAt();

        mvc.perform(json(put("/api/companies/{id}", original.getId()), body(
                        " Servicios del Valle Ltda ", "3-101-300004", " Gerencia@Valle.Test ", "8888-9999", " Cartago ")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("id").value(original.getId()))
                .andExpect(jsonPath("businessName").value("Servicios del Valle Ltda"))
                .andExpect(jsonPath("active").value(true));

        Company company = stored(original.getId());
        assertThat(company.getBusinessName()).isEqualTo("Servicios del Valle Ltda");
        assertThat(company.getTaxId()).isEqualTo("3-101-300004");
        assertThat(company.getContactEmail()).isEqualTo("gerencia@valle.test");
        assertThat(company.getPhoneNumber()).isEqualTo("8888-9999");
        assertThat(company.getAddress()).isEqualTo("Cartago");
        assertThat(company.isActive()).isTrue();
        assertThat(company.getCreatedAt()).isEqualTo(createdAt);
        assertThat(companyRepository.count()).isEqualTo(1);
    }

    @Test
    void updateClearsOptionalFieldsSentBlankOrLeftOut() throws Exception {
        Company original = persistFullCompany();

        mvc.perform(json(put("/api/companies/{id}", original.getId()), body(
                        "Servicios del Valle", "3-101-300001", "contacto@valle.test", " ", null)))
                .andExpect(status().isOk());

        Company company = stored(original.getId());
        assertThat(company.getPhoneNumber()).isNull();
        assertThat(company.getAddress()).isNull();
    }

    @Test
    void rejectedUpdateLeavesTheStoredRowUntouched() throws Exception {
        Company original = persistFullCompany();

        mvc.perform(json(put("/api/companies/{id}", original.getId()), body(
                        "Otro nombre", "3-101-300005", "no-es-correo", "1111-2222", "Limón")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("fieldErrors.contactEmail").value("Escriba un correo válido."));

        Company company = stored(original.getId());
        assertThat(company.getBusinessName()).isEqualTo("Servicios del Valle");
        assertThat(company.getTaxId()).isEqualTo("3-101-300001");
        assertThat(company.getPhoneNumber()).isEqualTo("2222-3333");
        assertThat(company.getAddress()).isEqualTo("San José");
    }

    @Test
    void updatingAnUnknownCompanyAnswers404AndCreatesNothing() throws Exception {
        mvc.perform(json(put("/api/companies/{id}", 999_999), body(
                        "Fantasma", "3-101-300006", "fantasma@empresa.test", null, null)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("message").value("No se encontró la empresa."));
        assertThat(companyRepository.count()).isZero();
    }

    @Test
    void updateAnswersWithTheSameDataThatIsReadLater() throws Exception {
        Company original = persistFullCompany();

        MvcResult result = mvc.perform(json(put("/api/companies/{id}", original.getId()), body(
                        "Valle Renovado", "3-101-300007", "info@valle.test", "2233-4455", "Alajuela")))
                .andExpect(status().isOk())
                .andReturn();

        stored(original.getId());
        String read = mvc.perform(get("/api/companies/{id}", original.getId()).with(as(admin)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        assertThat(read).isEqualTo(result.getResponse().getContentAsString());
    }
}
