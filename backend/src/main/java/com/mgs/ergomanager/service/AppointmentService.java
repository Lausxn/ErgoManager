package com.mgs.ergomanager.service;

import com.mgs.ergomanager.dto.appointment.AppointmentRequestDTO;
import com.mgs.ergomanager.dto.appointment.AppointmentRescheduleRequestDTO;
import com.mgs.ergomanager.dto.appointment.AppointmentResponseDTO;
import java.time.LocalDateTime;
import java.util.List;

/**
 * Appointments booked on the time slots of the ergonomists.
 */
public interface AppointmentService {

    /**
     * Books an appointment on a free slot.
     *
     * @param request slot chosen by the employee
     * @return the booked appointment
     */
    AppointmentResponseDTO book(AppointmentRequestDTO request);

    /**
     * Returns the agenda of an ergonomist inside a date range.
     *
     * @param userId identifier of the ergonomist
     * @param from   beginning of the range
     * @param to     end of the range
     * @return list of appointments
     */
    List<AppointmentResponseDTO> findAgenda(Long userId, LocalDateTime from, LocalDateTime to);

    /**
     * Returns the appointments of every agenda inside a date range, for the
     * overview of an administrator.
     *
     * @param from beginning of the range
     * @param to   end of the range
     * @return list of appointments
     */
    List<AppointmentResponseDTO> findAllAgendas(LocalDateTime from, LocalDateTime to);

    /**
     * Cancels an appointment and frees its slot.
     *
     * @param id identifier of the appointment
     * @return the cancelled appointment
     */
    AppointmentResponseDTO cancel(Long id);

    /**
     * Moves a pending appointment to another free time slot of the same
     * ergonomist.
     *
     * @param id      identifier of the appointment
     * @param request new time slot selected for the appointment
     * @return the rescheduled appointment
     */
    AppointmentResponseDTO reschedule(Long id, AppointmentRescheduleRequestDTO request);
}
