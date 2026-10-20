package com.mgs.ergomanager.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.mgs.ergomanager.config.CompanyKeyBackfill;
import com.mgs.ergomanager.model.Company;
import com.mgs.ergomanager.model.CompanyKeys;
import com.mgs.ergomanager.model.enums.Role;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.MediaType;

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
    void databaseRejectsANameThatOnlyChangesCaseOrSpaces() {
        persistCompany("Servicios del Valle", "3-101-400004", true);
        assertThrows(DataIntegrityViolationException.class,
                () -> persistCompany("SERVICIOS  DEL valle", "3-101-400005", true));
    }

    @Test
    void databaseAcceptsNamesThatOnlyDifferInAccents() {
        persistCompany("Nandu", "3-101-400006", true);
        persistCompany("Ñandú", "3-101-400007", true);
        assertThat(companyRepository.count()).isEqualTo(2);
    }

    @Test
    void databaseRejectsTheSameTaxIdWrittenWithoutDashes() {
        persistCompany("Primera", "3-101-400008", true);
        assertThrows(DataIntegrityViolationException.class,
                () -> persistCompany("Segunda", "3101400008", true));
    }

    @Test
    void theApiStoresTheNameWithSingleSpaces() throws Exception {
        var admin = persistUser("admin.keys@example.test", Role.ADMIN);
        mvc.perform(post("/api/companies").with(as(admin)).contentType(MediaType.APPLICATION_JSON)
                        .content(toJson(Map.of("businessName", "  Grupo   Central  S.A. ", "taxId", "3-101-400009",
                                "contactEmail", "grupo@central.test"))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("businessName").value("Grupo Central S.A."));
    }

    @Test
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
