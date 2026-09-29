package com.mgs.ergomanager.repository;

import com.mgs.ergomanager.model.Availability;
import jakarta.persistence.LockModeType;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
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

    /**
     * Returns the free slots of an ergonomist inside a date range, ordered by
     * start and with the ergonomist already loaded.
     *
     * @param userId identifier of the ergonomist
     * @param from   beginning of the range
     * @param to     end of the range
     * @return ordered list of free slots
     */
    @EntityGraph(attributePaths = "user")
    List<Availability> findByUserIdAndTakenFalseAndStartDateTimeBetweenOrderByStartDateTimeAsc(Long userId,
                                                                                             LocalDateTime from,
                                                                                             LocalDateTime to);

    /**
     * Checks whether an ergonomist already has a slot that overlaps a range.
     * Two ranges overlap when each one starts before the other ends.
     *
     * @param userId identifier of the ergonomist
     * @param end    end of the new range
     * @param start  start of the new range
     * @return true when an overlapping slot exists
     */
    boolean existsByUserIdAndStartDateTimeBeforeAndEndDateTimeAfter(Long userId,
                                                                    LocalDateTime end,
                                                                    LocalDateTime start);

    /**
     * Reads a slot and locks it, so two employees cannot book it at once.
     *
     * @param id identifier of the slot
     * @return the slot, with its ergonomist, when it exists
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select a from Availability a join fetch a.user where a.id = :id")
    Optional<Availability> findByIdForUpdate(@Param("id") Long id);
}
