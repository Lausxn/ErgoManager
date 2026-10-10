package com.mgs.ergomanager.dto.appointment;

import jakarta.validation.constraints.NotNull;

/**
 * Request used to move an existing appointment to another available time slot.
 *
 * @param availabilityId identifier of the new time slot
 */
public record AppointmentRescheduleRequestDTO(

        @NotNull(message = "Este campo es obligatorio.")
        Long availabilityId) {
}