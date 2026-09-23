package com.mgs.ergomanager.repository;

import com.mgs.ergomanager.model.Answer;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

/**
 * Data access operations for the {@link Answer} entity.
 */
@Repository
public interface AnswerRepository extends JpaRepository<Answer, Long> {

    /**
     * Returns every answer that belongs to a self evaluation.
     *
     * @param selfEvaluationId identifier of the self evaluation
     * @return list of answers
     */
    List<Answer> findBySelfEvaluationId(Long selfEvaluationId);
}
