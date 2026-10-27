package com.mgs.ergomanager.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.mgs.ergomanager.hu.UserStories;
import com.mgs.ergomanager.model.Company;
import com.mgs.ergomanager.model.User;
import com.mgs.ergomanager.model.enums.Role;
import java.util.HashMap;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

/** Formats of the business name, the tax id and the phone number, checked only on new values. */
class CompanyFormatIntegrationTests extends ApiIntegrationTestSupport {

    private static final String TAX_ID_MESSAGE = "Escriba la cédula jurídica con el formato 3-101-123456.";
    private static final String PHONE_MESSAGE = "Escriba un teléfono válido de 8 a 15 dígitos, por ejemplo 2222-3333.";
    private static final String NAME_MESSAGE = "La razón social debe incluir letras o números.";

    private User admin;

    @BeforeEach
    void createAdmin() {
        admin = persistUser("admin.formats@example.test", Role.ADMIN);
    }

    private ResultActions save(MockHttpServletRequestBuilder request, String name, String taxId, String phone)
            throws Exception {
        Map<String, Object> body = new HashMap<>();
        body.put("businessName", name);
        body.put("taxId", taxId);
        body.put("contactEmail", "contacto@empresa.test");
        body.put("phoneNumber", phone);
        return mvc.perform(request.with(as(admin)).contentType(MediaType.APPLICATION_JSON).content(toJson(body)));
    }

    @ParameterizedTest
    @ValueSource(strings = {"3101600001", " 3 101 600001 ", "3-101600001", "31-01-600001", "3-101-600001"})
    @Tag(UserStories.HU_003)
    void storesTheTaxIdWithTheDashesOfTheLegalFormat(String typed) throws Exception {
        // Ten digits always get the dashes in their place, wherever they were typed.
        save(post("/api/companies"), "Formato", typed, null)
                .andExpect(status().isCreated())
                .andExpect(jsonPath("taxId").value("3-101-600001"));
    }

    @ParameterizedTest
    @ValueSource(strings = {"3-101-60000", "3-101-60000X", "3101ABC", "3-101-6000011"})
    @Tag(UserStories.HU_003)
    void rejectsATaxIdThatIsNotTheLegalFormat(String typed) throws Exception {
        save(post("/api/companies"), "Formato", typed, null)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("message").value("Revise los datos ingresados."))
                .andExpect(jsonPath("fieldErrors.taxId").value(TAX_ID_MESSAGE));
        assertThat(companyRepository.count()).isZero();
    }

    @Test
    @Tag(UserStories.HU_003)
    void checksThePhoneNumberOnlyWhenItIsSent() throws Exception {
        save(post("/api/companies"), "Teléfono corto", "3-101-600002", "123")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("fieldErrors.phoneNumber").value(PHONE_MESSAGE));
        save(post("/api/companies"), "Teléfono internacional", "3-101-600003", "+506 (2222) 3333")
                .andExpect(status().isCreated());
        save(post("/api/companies"), "Sin teléfono", "3-101-600004", "  ")
                .andExpect(status().isCreated());
    }

    @Test
    @Tag(UserStories.HU_003)
    void reportsEveryInvalidFormatTogetherAndBeforeAnyDuplicate() throws Exception {
        persistCompany("---", "3-101-600005", true);
        save(post("/api/companies"), "---", "123", "12")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("fieldErrors.businessName").value(NAME_MESSAGE))
                .andExpect(jsonPath("fieldErrors.taxId").value(TAX_ID_MESSAGE))
                .andExpect(jsonPath("fieldErrors.phoneNumber").value(PHONE_MESSAGE));
    }

    @Test
    @Tag(UserStories.HU_020)
    void aCompanyWithOlderFormatsCanBeEditedWhileThoseValuesDoNotChange() throws Exception {
        Company legacy = persistCompany("***", "3101ABC", true);
        legacy.setPhoneNumber("123");
        companyRepository.saveAndFlush(legacy);

        save(put("/api/companies/{id}", legacy.getId()), "***", "3101ABC", "123")
                .andExpect(status().isOk());

        save(put("/api/companies/{id}", legacy.getId()), "***", "3101ABC", "1234")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("fieldErrors.phoneNumber").value(PHONE_MESSAGE));
        save(put("/api/companies/{id}", legacy.getId()), "***", "3101ABD", "123")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("fieldErrors.taxId").value(TAX_ID_MESSAGE));
        save(put("/api/companies/{id}", legacy.getId()), "Empresa Antigua", "3-101-600006", "2222-3333")
                .andExpect(status().isOk())
                .andExpect(jsonPath("taxId").value("3-101-600006"));
    }
}
