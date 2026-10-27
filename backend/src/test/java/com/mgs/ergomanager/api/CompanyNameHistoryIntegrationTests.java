package com.mgs.ergomanager.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.empty;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.mgs.ergomanager.hu.UserStories;
import com.mgs.ergomanager.model.Company;
import com.mgs.ergomanager.model.CompanyNameChange;
import com.mgs.ergomanager.model.User;
import com.mgs.ergomanager.model.enums.Role;
import com.mgs.ergomanager.repository.CompanyNameChangeRepository;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

/** Previous names of a client: kept after a rename and reserved for that client. */
@Tag(UserStories.HU_020)
class CompanyNameHistoryIntegrationTests extends ApiIntegrationTestSupport {

    private static final String RESERVED_MESSAGE = "Ese nombre perteneció a otra empresa y queda reservado para ella. "
            + "Agregue un distintivo, por ejemplo un número o la sede.";

    @Autowired
    private CompanyNameChangeRepository nameChangeRepository;

    private User admin;
    private Company cocaCola;

    @BeforeEach
    void createClient() {
        admin = persistUser("admin.names@example.test", Role.ADMIN);
        cocaCola = persistCompany("Coca-Cola", "3-101-710001", true);
    }

    private ResultActions save(MockHttpServletRequestBuilder request, String name, String taxId) throws Exception {
        return mvc.perform(request.with(as(admin)).contentType(MediaType.APPLICATION_JSON)
                .content(toJson(Map.of("businessName", name, "taxId", taxId, "contactEmail", "contacto@empresa.test"))));
    }

    private ResultActions rename(Company company, String name) throws Exception {
        return save(put("/api/companies/{id}", company.getId()), name, company.getTaxId());
    }

    @Test
    void aRenameKeepsThePreviousNameAndWhoChangedIt() throws Exception {
        rename(cocaCola, "Coca-Cola FEMSA")
                .andExpect(status().isOk())
                .andExpect(jsonPath("businessName").value("Coca-Cola FEMSA"))
                .andExpect(jsonPath("previousNames", contains("Coca-Cola")));

        mvc.perform(get("/api/companies/{id}", cocaCola.getId()).with(as(admin)))
                .andExpect(jsonPath("previousNames", contains("Coca-Cola")));
        mvc.perform(get("/api/companies").with(as(admin)))
                .andExpect(jsonPath("$[0].previousNames", contains("Coca-Cola")));

        List<CompanyNameChange> changes = nameChangeRepository.findByCompanyIdOrderByChangedAtDescIdDesc(cocaCola.getId());
        assertThat(changes).hasSize(1);
        assertThat(changes.getFirst().getChangedBy().getId()).isEqualTo(admin.getId());
        assertThat(changes.getFirst().getChangedAt()).isNotNull();
    }

    @Test
    void changingOnlyCaseOrSpacesIsNotARename() throws Exception {
        rename(cocaCola, "  COCA-COLA ")
                .andExpect(status().isOk())
                .andExpect(jsonPath("businessName").value("COCA-COLA"))
                .andExpect(jsonPath("previousNames", empty()));
        assertThat(nameChangeRepository.count()).isZero();
    }

    @Test
    void severalRenamesListThePreviousNamesFromTheMostRecent() throws Exception {
        rename(cocaCola, "Coca-Cola FEMSA").andExpect(status().isOk());
        rename(cocaCola, "Coca-Cola Costa Rica")
                .andExpect(status().isOk())
                .andExpect(jsonPath("previousNames", contains("Coca-Cola FEMSA", "Coca-Cola")));
    }

    @Test
    void anotherCompanyCannotTakeAPreviousNameButCanAddADistinctive() throws Exception {
        rename(cocaCola, "Coca-Cola FEMSA").andExpect(status().isOk());

        save(post("/api/companies"), " COCA-COLA ", "3-101-710002")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("message").value(RESERVED_MESSAGE));
        Company other = persistCompany("Pepsi", "3-101-710003", true);
        rename(other, "coca-cola")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("message").value(RESERVED_MESSAGE));

        save(post("/api/companies"), "Coca-Cola 2", "3-101-710004").andExpect(status().isCreated());
    }

    @Test
    @Tag(UserStories.HU_021)
    void anInactiveCompanyStillReservesItsPreviousNames() throws Exception {
        rename(cocaCola, "Coca-Cola FEMSA").andExpect(status().isOk());
        mvc.perform(delete("/api/companies/{id}", cocaCola.getId()).with(as(admin)))
                .andExpect(status().isNoContent());

        save(post("/api/companies"), "Coca-Cola", "3-101-710005")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("message").value(RESERVED_MESSAGE));
    }

    @Test
    void theCompanyCanTakeBackOneOfItsPreviousNames() throws Exception {
        rename(cocaCola, "Coca-Cola FEMSA").andExpect(status().isOk());

        rename(cocaCola, "Coca-Cola")
                .andExpect(status().isOk())
                .andExpect(jsonPath("businessName").value("Coca-Cola"))
                .andExpect(jsonPath("previousNames", contains("Coca-Cola FEMSA")));
        // And back again: each name appears once.
        rename(cocaCola, "Coca-Cola FEMSA")
                .andExpect(status().isOk())
                .andExpect(jsonPath("previousNames", contains("Coca-Cola")));
        assertThat(nameChangeRepository.count()).isEqualTo(1);
    }
}
