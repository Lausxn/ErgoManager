package com.mgs.ergomanager.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;

import com.mgs.ergomanager.hu.UserStories;
import com.mgs.ergomanager.model.Company;
import com.mgs.ergomanager.model.CompanyNameChange;
import com.mgs.ergomanager.model.User;
import com.mgs.ergomanager.model.enums.Role;
import com.mgs.ergomanager.repository.CompanyNameChangeRepository;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.RepeatedTest;
import org.junit.jupiter.api.Tag;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Simultaneous changes of the same client, each one in its own committed
 * transaction, so they really compete for the row.
 */
@Transactional(propagation = Propagation.NOT_SUPPORTED)
class CompanyConcurrencyIntegrationTests extends ApiIntegrationTestSupport {

    @Autowired
    private PlatformTransactionManager transactionManager;

    @Autowired
    private CompanyNameChangeRepository nameChangeRepository;

    private TransactionTemplate transaction;
    private User admin;
    private Company company;
    private String taxId;

    @BeforeEach
    void commitClient() {
        transaction = new TransactionTemplate(transactionManager);
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        taxId = "3-101-" + String.format("%06d", Math.abs(suffix.hashCode()) % 1_000_000);
        transaction.executeWithoutResult(status -> {
            admin = persistUser("admin.concurrency." + suffix + "@example.test", Role.ADMIN);
            company = persistCompany("Cliente " + suffix, taxId, true);
        });
    }

    @AfterEach
    void removeCommittedData() {
        transaction.executeWithoutResult(status -> {
            nameChangeRepository.deleteAll(nameChangeRepository.findByCompanyIdOrderByChangedAtDescIdDesc(company.getId()));
            nameChangeRepository.flush();
            companyRepository.deleteById(company.getId());
            userRepository.deleteById(admin.getId());
        });
    }

    private MockHttpServletRequestBuilder rename(String name) {
        return put("/api/companies/{id}", company.getId()).with(as(admin)).contentType(MediaType.APPLICATION_JSON)
                .content(toJson(Map.of("businessName", name, "taxId", taxId, "contactEmail", "contacto@empresa.test")));
    }

    /** Sends every request at the same moment and returns their HTTP statuses. */
    private List<Integer> sendTogether(List<MockHttpServletRequestBuilder> requests) throws Exception {
        CountDownLatch ready = new CountDownLatch(requests.size());
        CountDownLatch start = new CountDownLatch(1);
        List<Future<Integer>> responses = new ArrayList<>();
        try (ExecutorService executor = Executors.newFixedThreadPool(requests.size())) {
            for (MockHttpServletRequestBuilder request : requests) {
                Callable<Integer> call = () -> {
                    ready.countDown();
                    start.await(10, TimeUnit.SECONDS);
                    return mvc.perform(request).andReturn().getResponse().getStatus();
                };
                responses.add(executor.submit(call));
            }
            assertThat(ready.await(10, TimeUnit.SECONDS)).isTrue();
            start.countDown();
            List<Integer> statuses = new ArrayList<>();
            for (Future<Integer> response : responses) {
                statuses.add(response.get(30, TimeUnit.SECONDS));
            }
            return statuses;
        }
    }

    private Company stored() {
        return transaction.execute(status -> companyRepository.findById(company.getId()).orElseThrow());
    }

    private List<String> previousNames() {
        return transaction.execute(status -> nameChangeRepository
                .findByCompanyIdOrderByChangedAtDescIdDesc(company.getId()).stream()
                .map(CompanyNameChange::getBusinessName)
                .toList());
    }

    @RepeatedTest(3)
    @Tag(UserStories.HU_020)
    void twoSimultaneousRenamesKeepEveryPreviousName() throws Exception {
        String original = stored().getBusinessName();

        List<Integer> statuses = sendTogether(List.of(rename(original + " B"), rename(original + " C")));

        assertThat(statuses).containsOnly(200);
        String current = stored().getBusinessName();
        assertThat(current).isIn(original + " B", original + " C");
        String other = current.equals(original + " B") ? original + " C" : original + " B";
        // The one applied first is a previous name of the one applied last.
        assertThat(previousNames()).containsExactlyInAnyOrder(original, other);
    }

    @RepeatedTest(3)
    @Tag(UserStories.HU_020)
    @Tag(UserStories.HU_021)
    void aRenameAndADeactivationAtTheSameTimeKeepBothChanges() throws Exception {
        String original = stored().getBusinessName();

        List<Integer> statuses = sendTogether(List.of(rename(original + " Renombrada"),
                delete("/api/companies/{id}", company.getId()).with(as(admin))));

        assertThat(statuses).containsExactlyInAnyOrder(200, 204);
        Company company = stored();
        assertThat(company.getBusinessName()).isEqualTo(original + " Renombrada");
        assertThat(company.isActive()).isFalse();
        assertThat(previousNames()).containsExactly(original);
    }
}
