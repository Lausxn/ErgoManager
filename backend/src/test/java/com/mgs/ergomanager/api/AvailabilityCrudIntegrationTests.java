package com.mgs.ergomanager.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.mgs.ergomanager.model.Availability;
import com.mgs.ergomanager.model.User;
import com.mgs.ergomanager.model.enums.Role;
import java.time.LocalDateTime;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

/** CRUD of availability without modifying booked appointments. */
class AvailabilityCrudIntegrationTests extends ApiIntegrationTestSupport {

    private static final String URL = "/api/appointments/availabilities";
    private User owner;
    private User other;
    private User admin;
    private Availability slot;
    private LocalDateTime start;

    @BeforeEach
    void createData() {
        owner = persistUser("owner.availability@example.test", Role.ERGONOMIST);
        other = persistUser("other.availability@example.test", Role.ERGONOMIST);
        admin = persistUser("admin.availability@example.test", Role.ADMIN);
        start = futureAt(10, 8);
        slot = persistAvailability(owner, start, start.plusHours(1));
    }

    private MockHttpServletRequestBuilder update(long id, long userId, LocalDateTime from, LocalDateTime to) {
        return put(URL + "/{id}", id).contentType(MediaType.APPLICATION_JSON)
                .content(toJson(Map.of("userId", userId,
                        "startDateTime", from.format(QUERY_DATE_FORMAT),
                        "endDateTime", to.format(QUERY_DATE_FORMAT))));
    }

    @Test
    void ownerCanReadEditAndDeleteTheirSlot() throws Exception {
        mvc.perform(get(URL + "/{id}", slot.getId()).with(as(owner)))
                .andExpect(status().isOk()).andExpect(jsonPath("taken").value(false));
        mvc.perform(update(slot.getId(), owner.getId(), start.plusHours(2), start.plusHours(3)).with(as(owner)))
                .andExpect(status().isOk()).andExpect(jsonPath("userId").value(owner.getId()));
        availabilityRepository.flush();
        assertThat(availabilityRepository.findById(slot.getId()).orElseThrow().getStartDateTime())
                .isEqualTo(start.plusHours(2));
        mvc.perform(get(URL).with(as(owner)).param("userId", owner.getId().toString())
                        .param("from", start.format(QUERY_DATE_FORMAT))
                        .param("to", start.plusDays(1).format(QUERY_DATE_FORMAT)))
                .andExpect(status().isOk()).andExpect(jsonPath("$[0].id").value(slot.getId()));
        mvc.perform(delete(URL + "/{id}", slot.getId()).with(as(owner))).andExpect(status().isNoContent());
        mvc.perform(get(URL + "/{id}", slot.getId()).with(as(owner))).andExpect(status().isNotFound());
    }

    @Test
    void adminCanEditAndKeepingSameDatesDoesNotConflict() throws Exception {
        mvc.perform(update(slot.getId(), owner.getId(), start, start.plusHours(1)).with(as(admin)))
                .andExpect(status().isOk()).andExpect(jsonPath("taken").value(false));
        mvc.perform(get(URL + "/{id}", slot.getId()).with(as(admin))).andExpect(status().isOk());
    }

    @Test
    void otherErgonomistCannotReadOrEditEvenUsingTheirOwnIdInBody() throws Exception {
        mvc.perform(get(URL + "/{id}", slot.getId()).with(as(other))).andExpect(status().isForbidden());
        mvc.perform(update(slot.getId(), other.getId(), start, start.plusHours(1)).with(as(other)))
                .andExpect(status().isForbidden());
        mvc.perform(get(URL + "/{id}", slot.getId())).andExpect(status().isUnauthorized());
        mvc.perform(update(slot.getId(), owner.getId(), start, start.plusHours(1)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void ownerCannotBeChangedAndMissingSlotReturns404() throws Exception {
        mvc.perform(update(slot.getId(), other.getId(), start, start.plusHours(1)).with(as(admin)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("message").value("No se puede cambiar el propietario de la disponibilidad."));
        mvc.perform(update(999999, owner.getId(), start, start.plusHours(1)).with(as(owner)))
                .andExpect(status().isNotFound());
    }

    @Test
    void rejectsPastReversedEqualAndMissingDates() throws Exception {
        mvc.perform(update(slot.getId(), owner.getId(), start, start).with(as(owner)))
                .andExpect(status().isBadRequest());
        mvc.perform(update(slot.getId(), owner.getId(), start, start.minusHours(1)).with(as(owner)))
                .andExpect(status().isBadRequest());
        mvc.perform(update(slot.getId(), owner.getId(), start.minusDays(20), start.minusDays(19)).with(as(owner)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("fieldErrors.startDateTime").value("La fecha debe ser futura."));
        mvc.perform(put(URL + "/{id}", slot.getId()).with(as(owner))
                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isBadRequest());
        assertThat(slot.getStartDateTime()).isEqualTo(start);
    }

    @Test
    void keepsExistingOverlapRuleAndAllowsAdjacentSlots() throws Exception {
        persistAvailability(owner, start.plusHours(2), start.plusHours(3));
        mvc.perform(update(slot.getId(), owner.getId(), start.plusMinutes(90), start.plusMinutes(150))
                        .with(as(owner)))
                .andExpect(status().isConflict());
        assertThat(slot.getStartDateTime()).isEqualTo(start);
        mvc.perform(update(slot.getId(), owner.getId(), start.plusHours(1), start.plusHours(2)).with(as(owner)))
                .andExpect(status().isOk());
    }

    @Test
    void inactiveOrNonErgonomistOwnerCannotPublishNewDates() throws Exception {
        owner.setActive(false);
        userRepository.flush();
        mvc.perform(update(slot.getId(), owner.getId(), start, start.plusHours(1)).with(as(admin)))
                .andExpect(status().isBadRequest());
        owner.setActive(true);
        owner.setRole(Role.ADMIN);
        userRepository.flush();
        mvc.perform(update(slot.getId(), owner.getId(), start, start.plusHours(1)).with(as(admin)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void realBookingPreventsEditingAndDeletingTheSlot() throws Exception {
        var company = persistCompany("Empresa agenda", "61-001", true);
        var evaluation = persistSelfEvaluation(persistForm("Formulario agenda", 1), company, "employee@example.test");
        mvc.perform(post("/api/appointments").with(as(owner)).contentType(MediaType.APPLICATION_JSON)
                        .content(toJson(Map.of("selfEvaluationId", evaluation.getId(), "availabilityId", slot.getId()))))
                .andExpect(status().isCreated());
        mvc.perform(get(URL + "/{id}", slot.getId()).with(as(owner)))
                .andExpect(status().isOk()).andExpect(jsonPath("taken").value(true));
        mvc.perform(update(slot.getId(), owner.getId(), start.plusHours(2), start.plusHours(3)).with(as(admin)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("message").value("No se puede editar un espacio que ya tiene una cita."));
        mvc.perform(delete(URL + "/{id}", slot.getId()).with(as(owner))).andExpect(status().isBadRequest());
        assertThat(slot.getStartDateTime()).isEqualTo(start);
        assertThat(slot.isTaken()).isTrue();
    }
}
