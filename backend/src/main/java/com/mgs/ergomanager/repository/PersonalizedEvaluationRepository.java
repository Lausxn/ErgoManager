package com.mgs.ergomanager.repository;

import com.mgs.ergomanager.model.PersonalizedEvaluation;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

/**
 * Data access operations for the {@link PersonalizedEvaluation} entity.
 */
@Repository
public interface PersonalizedEvaluationRepository extends JpaRepository<PersonalizedEvaluation, Long> {

    /**
     * Returns the evaluation written for an appointment.
     *
     * @param appointmentId identifier of the appointment
     * @return the evaluation when it exists
     */
    Optional<PersonalizedEvaluation> findByAppointmentId(Long appointmentId);

    /**
     * Checks whether an appointment already has an evaluation.
     *
     * @param appointmentId identifier of the appointment
     * @return true when the evaluation exists
     */
    boolean existsByAppointmentId(Long appointmentId);

    /**
     * Returns the evaluations written by an ergonomist.
     *
     * @param userId identifier of the ergonomist
     * @return list of evaluations
     */
    List<PersonalizedEvaluation> findByUserId(Long userId);

    /**
     * Returns the evaluations written by an ergonomist, newest first, with the
     * associations needed to build their responses.
     *
     * @param userId identifier of the ergonomist
     * @return ordered list of evaluations
     */
    @Query("select p from PersonalizedEvaluation p join fetch p.appointment a join fetch a.selfEvaluation s"
            + " join fetch s.company join fetch p.user u where u.id = :userId"
            + " order by p.evaluatedAt desc, p.id desc")
    List<PersonalizedEvaluation> findDetailedByUserId(@Param("userId") Long userId);

    /**
     * Returns an evaluation with the associations needed by its response and report.
     *
     * @param id identifier of the evaluation
     * @return the evaluation when it exists
     */
    @Query("select p from PersonalizedEvaluation p join fetch p.appointment a join fetch a.selfEvaluation s"
            + " join fetch s.company join fetch p.user where p.id = :id")
    Optional<PersonalizedEvaluation> findDetailedById(@Param("id") Long id);

    /**
     * Returns which of the given appointments already have an evaluation.
     *
     * @param appointmentIds identifiers of the appointments
     * @return identifiers of the evaluated appointments
     */
    @Query("select p.appointment.id from PersonalizedEvaluation p where p.appointment.id in :appointmentIds")
    List<Long> findEvaluatedAppointmentIds(@Param("appointmentIds") Collection<Long> appointmentIds);
}
