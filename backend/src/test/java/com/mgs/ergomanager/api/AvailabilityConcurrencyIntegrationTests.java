package com.mgs.ergomanager.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;

import com.mgs.ergomanager.model.Availability;
import com.mgs.ergomanager.model.User;
import com.mgs.ergomanager.model.enums.Role;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

/** Separate real transactions verify that concurrent availability writes share the agenda lock. */
@Transactional(propagation = Propagation.NOT_SUPPORTED)
class AvailabilityConcurrencyIntegrationTests extends ApiIntegrationTestSupport {

    private static final String URL = "/api/appointments/availabilities";
    @Autowired
    private PlatformTransactionManager transactionManager;
    private TransactionTemplate transaction;
    private User owner;
    private Availability first;
    private Availability second;
    private LocalDateTime start;

    @BeforeEach
    void commitTestData() {
        transaction = new TransactionTemplate(transactionManager);
        start = futureAt(12, 10);
        transaction.executeWithoutResult(status -> {
            owner = persistUser("concurrent." + UUID.randomUUID() + "@example.test", Role.ERGONOMIST);
            first = persistAvailability(owner, start.plusDays(1), start.plusDays(1).plusHours(1));
            second = persistAvailability(owner, start.plusDays(2), start.plusDays(2).plusHours(1));
        });
    }

    @AfterEach
    void removeCommittedTestData() {
        if (owner == null) {
            return;
        }
        transaction.executeWithoutResult(status -> {
            availabilityRepository.deleteAll(availabilityRepository.findAll().stream()
                    .filter(slot -> slot.getUser().getId().equals(owner.getId())).toList());
            availabilityRepository.flush();
            userRepository.deleteById(owner.getId());
        });
    }

    @ParameterizedTest
    @CsvSource({"false,false,0", "false,false,30", "false,true,0", "true,true,30"})
    void onlyOneConcurrentOverlappingRequestCanSucceed(boolean firstUpdate, boolean secondUpdate,
                                                      int secondOffset) throws Exception {
        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch begin = new CountDownLatch(1);
        try (var executor = Executors.newFixedThreadPool(2)) {
            var one = executor.submit(() -> send(firstUpdate, first.getId(), 0, ready, begin));
            var two = executor.submit(() -> send(secondUpdate, second.getId(), secondOffset, ready, begin));
            try {
                assertThat(ready.await(10, TimeUnit.SECONDS)).isTrue();
            } finally {
                begin.countDown();
            }
            List<Integer> statuses = List.of(one.get(30, TimeUnit.SECONDS), two.get(30, TimeUnit.SECONDS));
            assertThat(statuses).contains(409);
            assertThat(statuses.stream().filter(status -> status == 200 || status == 201).count()).isEqualTo(1);
            Long matches = transaction.execute(status -> availabilityRepository.findAll().stream()
                    .filter(slot -> slot.getUser().getId().equals(owner.getId()))
                    .filter(slot -> slot.getStartDateTime().isBefore(start.plusHours(2))
                            && slot.getEndDateTime().isAfter(start)).count());
            assertThat(matches).isEqualTo(1L);
        }
    }

    private int send(boolean update, long id, int offset, CountDownLatch ready,
                     CountDownLatch begin) throws Exception {
        ready.countDown();
        if (!begin.await(10, TimeUnit.SECONDS)) {
            throw new IllegalStateException("Concurrent test did not start");
        }
        var request = update ? put(URL + "/{id}", id) : post(URL);
        return mvc.perform(request.with(as(owner)).contentType(MediaType.APPLICATION_JSON)
                        .content(toJson(Map.of("userId", owner.getId(),
                                "startDateTime", start.plusMinutes(offset).format(QUERY_DATE_FORMAT),
                                "endDateTime", start.plusMinutes(offset).plusHours(1).format(QUERY_DATE_FORMAT)))))
                .andReturn().getResponse().getStatus();
    }
}
