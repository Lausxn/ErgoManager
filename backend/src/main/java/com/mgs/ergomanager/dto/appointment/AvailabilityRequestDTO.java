package com.mgs.ergomanager.dto.appointment;

import jakarta.validation.constraints.Future;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDateTime;

/**
 * Time slot published by an ergonomist.
 *
 * @param userId        identifier of the ergonomist
 * @param startDateTime moment the slot starts
 * @param endDateTime   moment the slot ends
 */
public record AvailabilityRequestDTO(

        @NotNull
        Long userId,

        @NotNull
        @Future
        LocalDateTime startDateTime,

        @NotNull
        @Future
        LocalDateTime endDateTime) {
}
