package com.mgs.ergomanager.dto.appointment;

import com.mgs.ergomanager.model.enums.AppointmentStatus;
import java.time.LocalDateTime;

/**
 * Appointment exposed by the API.
 *
 * @param id               identifier of the appointment
 * @param selfEvaluationId identifier of the self evaluation that originated it
 * @param userId           identifier of the assigned ergonomist
 * @param employeeName     full name of the employee being attended
 * @param startDateTime    moment the appointment starts
 * @param endDateTime      moment the appointment ends
 * @param status           current state of the appointment
 * @param notes            free text written when the appointment was booked
 */
public record AppointmentResponse(
        Long id,
        Long selfEvaluationId,
        Long userId,
        String employeeName,
        LocalDateTime startDateTime,
        LocalDateTime endDateTime,
        AppointmentStatus status,
        String notes) {
}
