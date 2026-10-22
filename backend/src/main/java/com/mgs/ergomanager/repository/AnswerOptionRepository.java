package com.mgs.ergomanager.repository;

import com.mgs.ergomanager.model.AnswerOption;
import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

/**
 * Data access operations for the {@link AnswerOption} entity.
 */
@Repository
public interface AnswerOptionRepository extends JpaRepository<AnswerOption, Long> {

    /**
     * Returns the active options of several questions in a single query,
     * ordered for display, so a whole form is mapped without N+1 queries.
     *
     * @param questionIds identifiers of the questions
     * @return ordered list of options
     */
    List<AnswerOption> findByQuestionIdInAndActiveTrueOrderByOptionOrderAsc(Collection<Long> questionIds);

    /**
     * Returns every option of several questions, active or not.
     *
     * @param questionIds identifiers of the questions
     * @return list of options
     */
    List<AnswerOption> findByQuestionIdIn(Collection<Long> questionIds);
}
