package com.mgs.ergomanager.repository;

import com.mgs.ergomanager.model.PersonalizedEvaluation;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
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
     * Returns the evaluations written by an ergonomist.
     *
     * @param userId identifier of the ergonomist
     * @return list of evaluations
     */
    List<PersonalizedEvaluation> findByUserId(Long userId);
}
