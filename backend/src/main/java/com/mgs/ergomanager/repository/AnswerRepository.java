package com.mgs.ergomanager.repository;

import com.mgs.ergomanager.model.Answer;
import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

/**
 * Data access operations for the {@link Answer} entity.
 */
@Repository
public interface AnswerRepository extends JpaRepository<Answer, Long> {

    /**
     * Returns every answer that belongs to a self evaluation, with its question.
     *
     * @param selfEvaluationId identifier of the self evaluation
     * @return list of answers
     */
    @EntityGraph(attributePaths = "question")
    List<Answer> findBySelfEvaluationId(Long selfEvaluationId);

    /**
     * Returns the answers of several self evaluations in a single query, with
     * their questions, so lists can be mapped without N+1 queries.
     *
     * @param selfEvaluationIds identifiers of the self evaluations
     * @return list of answers
     */
    @EntityGraph(attributePaths = "question")
    List<Answer> findBySelfEvaluationIdIn(Collection<Long> selfEvaluationIds);
}
