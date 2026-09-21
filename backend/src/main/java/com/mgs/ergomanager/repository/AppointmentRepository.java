package com.mgs.ergomanager.repository;

import com.mgs.ergomanager.model.Appointment;
import com.mgs.ergomanager.model.enums.AppointmentStatus;
import java.time.LocalDateTime;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

/**
 * Data access operations for the {@link Appointment} entity.
 */
@Repository
public interface AppointmentRepository extends JpaRepository<Appointment, Long> {

    /**
     * Returns the agenda of an ergonomist inside a date range.
     *
     * @param userId identifier of the ergonomist
     * @param from   beginning of the range
     * @param to     end of the range
     * @return list of appointments
     */
    List<Appointment> findByUserIdAndStartDateTimeBetween(Long userId, LocalDateTime from, LocalDateTime to);

    /**
     * Returns the appointments that are in a given state.
     *
     * @param status state to filter by
     * @return list of appointments
     */
    List<Appointment> findByStatus(AppointmentStatus status);
}
