package com.mgs.ergomanager.dto.appointment;

import java.time.LocalDateTime;

/**
 * Time slot exposed by the API.
 *
 * @param id            identifier of the slot
 * @param userId        identifier of the ergonomist
 * @param fullName      display name of the ergonomist
 * @param startDateTime moment the slot starts
 * @param endDateTime   moment the slot ends
 * @param taken         true when an appointment already uses the slot
 */
public record AvailabilityResponseDTO(
        Long id,
        Long userId,
        String fullName,
        LocalDateTime startDateTime,
        LocalDateTime endDateTime,
        boolean taken) {
}
