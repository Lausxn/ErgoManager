package com.mgs.ergomanager.service;

import com.mgs.ergomanager.dto.appointment.AvailabilityRequestDTO;
import com.mgs.ergomanager.dto.appointment.AvailabilityResponseDTO;
import java.time.LocalDateTime;
import java.util.List;

/**
 * Time slots the ergonomists publish so appointments can be booked on them.
 */
public interface AvailabilityService {

    /**
     * Publishes a new time slot for an ergonomist.
     *
     * @param request data of the slot
     * @return the created slot
     */
    AvailabilityResponseDTO createAvailability(AvailabilityRequestDTO request);

    /**
     * Reads one slot, including its reserved state.
     *
     * @param id identifier of the slot
     * @return the slot
     */
    AvailabilityResponseDTO findAvailabilityById(Long id);

    /**
     * Changes the dates of a free slot without changing its owner.
     *
     * @param id      identifier of the slot
     * @param request new dates of the slot
     * @return the updated slot
     */
    AvailabilityResponseDTO updateAvailability(Long id, AvailabilityRequestDTO request);

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
     * Deletes a slot that has not been booked.
     *
     * @param id identifier of the slot
     */
    void deleteAvailability(Long id);
}
