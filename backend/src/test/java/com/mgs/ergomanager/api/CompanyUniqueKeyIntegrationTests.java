package com.mgs.ergomanager.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.mgs.ergomanager.config.CompanyKeyBackfill;
import com.mgs.ergomanager.hu.UserStories;
import com.mgs.ergomanager.model.Company;
import com.mgs.ergomanager.model.CompanyKeys;
import com.mgs.ergomanager.model.User;
import com.mgs.ergomanager.model.enums.Role;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.util.Map;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

/** Unique business name and tax id enforced by the comparison keys of the database. */
class CompanyUniqueKeyIntegrationTests extends ApiIntegrationTestSupport {

    @PersistenceContext
    private EntityManager entityManager;

    @Autowired
    private CompanyKeyBackfill backfill;

    private Company reload(Company company) {
        entityManager.flush();
        entityManager.clear();
        return companyRepository.findById(company.getId()).orElseThrow();
    }

    /** Inserts a company the way older versions did, without comparison keys. */
    private long insertWithoutKeys(String businessName, String taxId) {
        entityManager.createNativeQuery("insert into companies (business_name, tax_id, contact_email, active, created_at) "
                        + "values (?1, ?2, 'legacy@empresa.test', true, current_timestamp)")
                .setParameter(1, businessName)
                .setParameter(2, taxId)
                .executeUpdate();
        return ((Number) entityManager.createNativeQuery("select id from companies where tax_id = ?1")
                .setParameter(1, taxId)
                .getSingleResult()).longValue();
    }

    @Test
    @Tag(UserStories.HU_003)
    @Tag(UserStories.HU_020)
    void everySavedCompanyGetsItsKeysAndARenameRefreshesThem() {
        Company company = reload(persistCompany("Acme S.A.", "3-101-400001", true));
        assertThat(company.getBusinessNameKey()).isEqualTo(CompanyKeys.businessNameKey("acme s.a."));
        assertThat(company.getTaxIdKey()).isEqualTo("3101400001");

        company.setBusinessName("Acme Ltda");
        company.setTaxId("3-101-400002");
        companyRepository.saveAndFlush(company);
        company = reload(company);
        assertThat(company.getBusinessNameKey()).isEqualTo(CompanyKeys.businessNameKey("Acme Ltda"));
        assertThat(company.getTaxIdKey()).isEqualTo("3101400002");
        // The old name is free again.
        persistCompany("ACME S.A.", "3-101-400003", true);
    }

    @Test
    @Tag(UserStories.HU_003)
    void databaseRejectsANameThatOnlyChangesCaseOrSpaces() {
        persistCompany("Servicios del Valle", "3-101-400004", true);
        assertThrows(DataIntegrityViolationException.class,
                () -> persistCompany("SERVICIOS  DEL valle", "3-101-400005", true));
    }

    @Test
    @Tag(UserStories.HU_003)
    void databaseAcceptsNamesThatOnlyDifferInAccents() {
        persistCompany("Nandu", "3-101-400006", true);
        persistCompany("Ñandú", "3-101-400007", true);
        assertThat(companyRepository.count()).isEqualTo(2);
    }

    @Test
    @Tag(UserStories.HU_003)
    void databaseRejectsTheSameTaxIdWrittenWithoutDashes() {
        persistCompany("Primera", "3-101-400008", true);
        assertThrows(DataIntegrityViolationException.class,
                () -> persistCompany("Segunda", "3101400008", true));
    }

    @Test
    @Tag(UserStories.HU_003)
    void theApiStoresTheNameWithSingleSpaces() throws Exception {
        var admin = persistUser("admin.keys@example.test", Role.ADMIN);
        mvc.perform(post("/api/companies").with(as(admin)).contentType(MediaType.APPLICATION_JSON)
                        .content(toJson(Map.of("businessName", "  Grupo   Central  S.A. ", "taxId", "3-101-400009",
                                "contactEmail", "grupo@central.test"))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("businessName").value("Grupo Central S.A."));
    }

    private ResultActions save(MockHttpServletRequestBuilder request, String name, String taxId) throws Exception {
        User admin = userRepository.findByEmail("admin.api.keys@example.test")
                .orElseGet(() -> persistUser("admin.api.keys@example.test", Role.ADMIN));
        return mvc.perform(request.with(as(admin)).contentType(MediaType.APPLICATION_JSON)
                .content(toJson(Map.of("businessName", name, "taxId", taxId, "contactEmail", "contacto@empresa.test"))));
    }

    @Test
    @Tag(UserStories.HU_003)
    void theApiRejectsANameThatOnlyChangesCaseOrSpacesAndAcceptsOneWithOtherAccents() throws Exception {
        persistCompany("Nandu S.A.", "3-101-400020", true);
        save(post("/api/companies"), "  NANDU   s.a. ", "3-101-400021")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("message").value("Ya existe una empresa con ese nombre."));
        save(post("/api/companies"), "Ñandú S.A.", "3-101-400022")
                .andExpect(status().isCreated());
    }

    @Test
    @Tag(UserStories.HU_003)
    @Tag(UserStories.HU_020)
    void theApiRejectsATaxIdWrittenWithoutDashesOnCreateAndUpdate() throws Exception {
        persistCompany("Primera", "3-101-400023", true);
        Company second = persistCompany("Segunda", "3-101-400024", true);
        save(post("/api/companies"), "Tercera", "3101400023")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("message").value("Ya existe una empresa con esa cédula jurídica."));
        save(put("/api/companies/{id}", second.getId()), "Segunda", "3 101 400023")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("message").value("Ya existe una empresa con esa cédula jurídica."));
        assertThat(reload(second).getTaxId()).isEqualTo("3-101-400024");
    }

    @Test
    @Tag(UserStories.HU_020)
    void aRenameToAnotherCompanyNameIsRejectedAndKeepsTheStoredName() throws Exception {
        persistCompany("Grupo Norte", "3-101-400025", true);
        Company other = persistCompany("Grupo Sur", "3-101-400026", true);
        save(put("/api/companies/{id}", other.getId()), "grupo  NORTE", "3-101-400026")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("message").value("Ya existe una empresa con ese nombre."));
        assertThat(reload(other).getBusinessName()).isEqualTo("Grupo Sur");
    }

    @Test
    @Tag(UserStories.HU_020)
    void aCompanyThatRepeatsAnOlderNameMustBeRenamedWhenItIsEdited() throws Exception {
        long original = insertWithoutKeys("Repetida S.A.", "3-101-400027");
        long repeated = insertWithoutKeys("REPETIDA s.a.", "3-101-400028");
        backfill.run(null);
        entityManager.clear();

        save(put("/api/companies/{id}", repeated), "REPETIDA s.a.", "3-101-400028")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("message").value("Ya existe una empresa con ese nombre."));
        save(put("/api/companies/{id}", repeated), "Repetida Dos S.A.", "3-101-400028")
                .andExpect(status().isOk());
        // The company that kept the name is edited normally.
        save(put("/api/companies/{id}", original), "Repetida S.A.", "3-101-400027")
                .andExpect(status().isOk());
    }

    @Test
    @Tag(UserStories.HU_021)
    void aRepeatedOlderCompanyCanBeDeactivatedAndActivatedWithoutRebuildingItsKeys() throws Exception {
        insertWithoutKeys("Duplicada S.A.", "3-101-400030");
        long repeatedName = insertWithoutKeys("DUPLICADA  s.a.", "3-101-400031");
        long repeatedTaxId = insertWithoutKeys("Otra Duplicada", "3101400030");
        backfill.run(null);
        entityManager.clear();
        User admin = persistUser("admin.legacy.state@example.test", Role.ADMIN);

        for (long id : new long[] {repeatedName, repeatedTaxId}) {
            mvc.perform(delete("/api/companies/{id}", id).with(as(admin))).andExpect(status().isNoContent());
            Company deactivated = reload(companyRepository.getReferenceById(id));
            assertThat(deactivated.isActive()).isFalse();

            mvc.perform(patch("/api/companies/{id}/activate", id).with(as(admin))).andExpect(status().isOk());
            assertThat(reload(companyRepository.getReferenceById(id)).isActive()).isTrue();
        }
        // The repeated value keeps its key empty, so the rule still asks to correct it.
        assertThat(companyRepository.findById(repeatedName).orElseThrow().getBusinessNameKey()).isNull();
        assertThat(companyRepository.findById(repeatedTaxId).orElseThrow().getTaxIdKey()).isNull();
        save(put("/api/companies/{id}", repeatedName), "DUPLICADA  s.a.", "3-101-400031")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("message").value("Ya existe una empresa con ese nombre."));
        save(put("/api/companies/{id}", repeatedTaxId), "Otra Duplicada", "3101400030")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("message").value("Ya existe una empresa con esa cédula jurídica."));
    }

    @Test
    @Tag(UserStories.HU_020)
    void correctingARepeatedOlderCompanyFillsItsKeys() throws Exception {
        insertWithoutKeys("Corregible S.A.", "3-101-400032");
        long repeated = insertWithoutKeys("CORREGIBLE s.a.", "3101400032");
        backfill.run(null);
        entityManager.clear();

        save(put("/api/companies/{id}", repeated), "Corregible Dos S.A.", "3-101-400033")
                .andExpect(status().isOk());
        Company corrected = reload(companyRepository.getReferenceById(repeated));
        assertThat(corrected.getBusinessNameKey()).isEqualTo(CompanyKeys.businessNameKey("Corregible Dos S.A."));
        assertThat(corrected.getTaxIdKey()).isEqualTo("3101400033");
    }

    @Test
    @Tag(UserStories.HU_003)
    void backfillFillsTheKeysOfOlderCompaniesAndSkipsRepeatedOnes() {
        long first = insertWithoutKeys("Antigua S.A.", "3-101-400010");
        long sameName = insertWithoutKeys("ANTIGUA  s.a.", "3-101-400011");
        long sameTaxId = insertWithoutKeys("Otra Antigua", "3101400010");

        backfill.run(null);
        entityManager.clear();

        Company kept = companyRepository.findById(first).orElseThrow();
        assertThat(kept.getBusinessNameKey()).isEqualTo(CompanyKeys.businessNameKey("Antigua S.A."));
        assertThat(kept.getTaxIdKey()).isEqualTo("3101400010");
        Company repeatedName = companyRepository.findById(sameName).orElseThrow();
        assertThat(repeatedName.getBusinessNameKey()).isNull();
        assertThat(repeatedName.getTaxIdKey()).isEqualTo("3101400011");
        Company repeatedTaxId = companyRepository.findById(sameTaxId).orElseThrow();
        assertThat(repeatedTaxId.getBusinessNameKey()).isEqualTo(CompanyKeys.businessNameKey("Otra Antigua"));
        assertThat(repeatedTaxId.getTaxIdKey()).isNull();

        // A second start finds only the repeated companies and changes nothing.
        backfill.run(null);
        entityManager.clear();
        assertThat(companyRepository.findById(sameName).orElseThrow().getBusinessNameKey()).isNull();
    }
}
