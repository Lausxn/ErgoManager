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
     * Checks whether an appointment already has an evaluation.
     *
     * @param appointmentId identifier of the appointment
     * @return true when the evaluation exists
     */
    boolean existsByAppointmentId(Long appointmentId);

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

    /**
     * Returns every personalized evaluation with the employee, company,
     * ergonomist and form, used by the evaluation report, which filters and
     * sorts them.
     *
     * @return list of personalized evaluations
     */
    @Query("select p from PersonalizedEvaluation p join fetch p.appointment a join fetch a.selfEvaluation s"
            + " join fetch s.company join fetch p.user left join fetch p.form")
    List<PersonalizedEvaluation> findAllForReport();

    /**
     * Returns the evaluations of one ergonomist with everything a report row
     * needs, so an ergonomist only reads their own.
     *
     * @param userId identifier of the ergonomist
     * @return evaluations of the ergonomist
     */
    @Query("select p from PersonalizedEvaluation p join fetch p.appointment a join fetch a.selfEvaluation s"
            + " join fetch s.company join fetch p.user u left join fetch p.form where u.id = :userId")
    List<PersonalizedEvaluation> findAllForReportByUserId(@Param("userId") Long userId);
}
