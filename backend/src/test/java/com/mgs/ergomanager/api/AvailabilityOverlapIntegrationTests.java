package com.mgs.ergomanager.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.mgs.ergomanager.hu.UserStories;
import com.mgs.ergomanager.model.Availability;
import com.mgs.ergomanager.model.User;
import com.mgs.ergomanager.model.enums.Role;
import java.time.LocalDateTime;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

/** Range conflicts through the real availability API, including update exclusions. */
@Tag(UserStories.HU_016)
class AvailabilityOverlapIntegrationTests extends ApiIntegrationTestSupport {

    private static final String URL = "/api/appointments/availabilities";
    private static final String MESSAGE = "El horario seleccionado se cruza con una disponibilidad existente. Seleccione otro rango de fecha y hora.";
    private User owner;
    private Availability existing;
    private Availability edited;
    private LocalDateTime start;

    @BeforeEach
    void createSlots() {
        owner = persistUser("overlap.owner@example.test", Role.ERGONOMIST);
        start = futureAt(10, 10);
        existing = persistAvailability(owner, start, start.plusHours(1));
        edited = persistAvailability(owner, start.plusDays(1), start.plusDays(1).plusHours(1));
    }

    private MockHttpServletRequestBuilder request(boolean update, long userId,
                                                  LocalDateTime from, LocalDateTime to) {
        var request = update ? put(URL + "/{id}", edited.getId()) : post(URL);
        return request.with(as(owner)).contentType(MediaType.APPLICATION_JSON)
                .content(toJson(Map.of("userId", userId, "startDateTime", from.format(QUERY_DATE_FORMAT),
                        "endDateTime", to.format(QUERY_DATE_FORMAT))));
    }

    @ParameterizedTest(name = "create rejects [{0}, {1}) minutes relative to 10:00")
    @CsvSource({"0,60", "30,90", "-30,30", "15,45", "-60,120"})
    void rejectsEveryOverlapOnCreate(int from, int to) throws Exception {
        mvc.perform(request(false, owner.getId(), start.plusMinutes(from), start.plusMinutes(to)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("status").value(409))
                .andExpect(jsonPath("message").value(MESSAGE));
        assertThat(availabilityRepository.count()).isEqualTo(2);
    }

    @ParameterizedTest(name = "update rejects [{0}, {1}) minutes relative to 10:00")
    @CsvSource({"0,60", "30,90", "-30,30", "15,45", "-60,120"})
    void rejectsEveryOverlapOnUpdateWithoutChangingStoredRange(int from, int to) throws Exception {
        mvc.perform(request(true, owner.getId(), start.plusMinutes(from), start.plusMinutes(to)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("message").value(MESSAGE));
        assertThat(availabilityRepository.findById(edited.getId()).orElseThrow().getStartDateTime())
                .isEqualTo(start.plusDays(1));
        assertThat(availabilityRepository.count()).isEqualTo(2);
    }

    @ParameterizedTest
    @CsvSource({"false,-60,0", "false,60,120", "true,-60,0", "true,60,120"})
    void allowsAdjacentRangesOnEitherSide(boolean update, int from, int to) throws Exception {
        mvc.perform(request(update, owner.getId(), start.plusMinutes(from), start.plusMinutes(to)))
                .andExpect(update ? status().isOk() : status().isCreated());
    }

    @Test
    void allowsEditingWithoutChangingItsOwnRange() throws Exception {
        mvc.perform(request(true, owner.getId(), edited.getStartDateTime(), edited.getEndDateTime()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("id").value(edited.getId()));
    }

    @Test
    void differentErgonomistsCanPublishTheSameRange() throws Exception {
        User other = persistUser("overlap.other@example.test", Role.ERGONOMIST);
        mvc.perform(request(false, other.getId(), start, start.plusHours(1)).with(as(other)))
                .andExpect(status().isCreated());
    }

    @Test
    void bookedSlotsStillBlockOverlaps() throws Exception {
        existing.setTaken(true);
        availabilityRepository.flush();
        mvc.perform(request(false, owner.getId(), start.plusMinutes(30), start.plusMinutes(90)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("message").value(MESSAGE));
    }

    @Test
    void detectsOverlapsAcrossMidnight() throws Exception {
        LocalDateTime midnight = start.plusDays(2).toLocalDate().atStartOfDay();
        persistAvailability(owner, midnight.minusMinutes(30), midnight.plusMinutes(30));
        mvc.perform(request(false, owner.getId(), midnight, midnight.plusHours(1)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("message").value(MESSAGE));
    }
}
