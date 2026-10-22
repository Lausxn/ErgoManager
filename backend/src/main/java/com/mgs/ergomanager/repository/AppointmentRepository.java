package com.mgs.ergomanager.repository;

import com.mgs.ergomanager.model.Appointment;
import com.mgs.ergomanager.model.enums.AppointmentStatus;
import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
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
     * Returns the agenda of an ergonomist inside a date range, ordered by start,
     * with the self evaluation, the company and the ergonomist already loaded.
     *
     * @param userId identifier of the ergonomist
     * @param from   beginning of the range
     * @param to     end of the range
     * @return ordered list of appointments
     */
    @Query("select a from Appointment a join fetch a.selfEvaluation s join fetch s.company join fetch a.user u"
            + " where u.id = :userId and a.startDateTime between :from and :to order by a.startDateTime asc")
    List<Appointment> findAgenda(@Param("userId") Long userId,
                                 @Param("from") LocalDateTime from,
                                 @Param("to") LocalDateTime to);

    /**
     * Returns an appointment with the associations needed to build its response.
     *
     * @param id identifier of the appointment
     * @return the appointment when it exists
     */
    @Query("select a from Appointment a join fetch a.selfEvaluation s join fetch s.company join fetch a.user"
            + " left join fetch a.availability where a.id = :id")
    Optional<Appointment> findDetailedById(@Param("id") Long id);

    /**
     * Returns the appointments that are in a given state.
     *
     * @param status state to filter by
     * @return list of appointments
     */
    List<Appointment> findByStatus(AppointmentStatus status);

    /**
     * Checks whether a self evaluation already has an appointment in one of the states.
     *
     * @param selfEvaluationId identifier of the self evaluation
     * @param statuses         states to look for
     * @return true when such an appointment exists
     */
    boolean existsBySelfEvaluationIdAndStatusIn(Long selfEvaluationId, Collection<AppointmentStatus> statuses);

    /**
     * Counts the appointments in the given states that start from a moment on.
     *
     * @param statuses states to count
     * @param from     earliest start
     * @return number of appointments
     */
    long countByStatusInAndStartDateTimeGreaterThanEqual(Collection<AppointmentStatus> statuses,
                                                          LocalDateTime from);

    /**
     * Detaches the appointments, normally cancelled ones, from a slot that is
     * about to be deleted.
     *
     * @param availabilityId identifier of the slot
     * @return number of updated appointments
     */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("update Appointment a set a.availability = null where a.availability.id = :availabilityId")
    int detachAvailability(@Param("availabilityId") Long availabilityId);
}
