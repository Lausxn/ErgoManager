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

        @NotNull(message = "Este campo es obligatorio.")
        Long selfEvaluationId,

        @NotNull(message = "Este campo es obligatorio.")
        Long availabilityId,

        @Size(max = 500, message = "Use un máximo de 500 caracteres.")
        String notes) {

    /** Trims the notes and turns blank notes into null. */
    public AppointmentRequestDTO {
        notes = notes == null || notes.isBlank() ? null : notes.trim();
    }
}
