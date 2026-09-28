package com.mgs.ergomanager.dto.appointment;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * Booking request sent by an employee after a self evaluation.
 *
 * @param selfEvaluationId identifier of the self evaluation that originated it
 * @param availabilityId   identifier of the chosen time slot
 * @param notes            free text the employee wants the ergonomist to read
 */
public record AppointmentRequestDTO(

        @NotNull
        Long selfEvaluationId,

        @NotNull
        Long availabilityId,

        @Size(max = 500)
        String notes) {
}
