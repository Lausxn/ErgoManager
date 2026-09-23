package com.mgs.ergomanager.repository;

import com.mgs.ergomanager.model.Availability;
import java.time.LocalDateTime;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

/**
 * Data access operations for the {@link Availability} entity.
 */
@Repository
public interface AvailabilityRepository extends JpaRepository<Availability, Long> {

    /**
     * Returns the free slots of an ergonomist inside a date range.
     *
     * @param userId identifier of the ergonomist
     * @param from   beginning of the range
     * @param to     end of the range
     * @return list of free slots
     */
    List<Availability> findByUserIdAndTakenFalseAndStartDateTimeBetween(Long userId,
                                                                       LocalDateTime from,
                                                                       LocalDateTime to);
}
