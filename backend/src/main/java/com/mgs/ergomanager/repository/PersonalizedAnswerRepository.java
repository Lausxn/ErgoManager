package com.mgs.ergomanager.repository;

import com.mgs.ergomanager.model.PersonalizedAnswer;
import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

/**
 * Data access operations for the {@link PersonalizedAnswer} entity.
 */
@Repository
public interface PersonalizedAnswerRepository extends JpaRepository<PersonalizedAnswer, Long> {

    /**
     * Returns the answers of an evaluation in the order of its questions.
     *
     * @param evaluationId identifier of the personalized evaluation
     * @return ordered list of answers
     */
    List<PersonalizedAnswer> findByEvaluationIdOrderByQuestionOrderAscIdAsc(Long evaluationId);

    /**
     * Returns the answers of several evaluations in a single query, so lists of
     * evaluations are mapped without N+1 queries.
     *
     * @param evaluationIds identifiers of the personalized evaluations
     * @return ordered list of answers
     */
    List<PersonalizedAnswer> findByEvaluationIdInOrderByQuestionOrderAscIdAsc(Collection<Long> evaluationIds);
}
