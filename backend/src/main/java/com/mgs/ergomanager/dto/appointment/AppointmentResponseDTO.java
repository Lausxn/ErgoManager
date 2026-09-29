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
 * @param employeeEmail    email of the employee being attended
 * @param companyId        identifier of the company the employee works for
 * @param companyName      business name of that company
 * @param ergonomistName   full name of the assigned ergonomist
 * @param evaluated        true when a personalized evaluation was written for it
 */
public record AppointmentResponseDTO(
        Long id,
        Long selfEvaluationId,
        Long userId,
        String employeeName,
        LocalDateTime startDateTime,
        LocalDateTime endDateTime,
        AppointmentStatus status,
        String notes,
        String employeeEmail,
        Long companyId,
        String companyName,
        String ergonomistName,
        boolean evaluated) {
}
