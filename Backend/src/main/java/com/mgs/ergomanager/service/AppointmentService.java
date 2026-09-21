package com.mgs.ergomanager.service;

import com.mgs.ergomanager.dto.appointment.AppointmentRequestDTO;
import com.mgs.ergomanager.dto.appointment.AppointmentResponseDTO;
import com.mgs.ergomanager.dto.appointment.AvailabilityRequestDTO;
import com.mgs.ergomanager.dto.appointment.AvailabilityResponseDTO;
import java.time.LocalDateTime;
import java.util.List;

/**
 * Availability published by the ergonomists and appointments booked on it.
 */
public interface AppointmentService {

    /**
     * Publishes a new time slot for an ergonomist.
     *
     * @param request data of the slot
     * @return the created slot
     */
    AvailabilityResponseDTO createAvailability(AvailabilityRequestDTO request);

    /**
     * Returns the free slots of an ergonomist inside a date range.
     *
     * @param userId identifier of the ergonomist
     * @param from   beginning of the range
     * @param to     end of the range
     * @return list of free slots
     */
    List<AvailabilityResponseDTO> findFreeAvailabilities(Long userId, LocalDateTime from, LocalDateTime to);

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
     * Cancels an appointment and frees its slot.
     *
     * @param id identifier of the appointment
     * @return the cancelled appointment
     */
    AppointmentResponseDTO cancel(Long id);
}
