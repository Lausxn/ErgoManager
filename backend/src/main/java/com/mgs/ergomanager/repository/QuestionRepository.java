package com.mgs.ergomanager.repository;

import com.mgs.ergomanager.model.Question;
import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

/**
 * Data access operations for the {@link Question} entity.
 */
@Repository
public interface QuestionRepository extends JpaRepository<Question, Long> {

    /**
     * Returns the active questions of a form, already ordered for display.
     *
     * @param formId identifier of the form
     * @return ordered list of questions
     */
    List<Question> findByFormIdAndActiveTrueOrderByQuestionOrderAsc(Long formId);

    /**
     * Returns the active questions of several forms in a single query, ordered
     * for display, so lists of forms are mapped without N+1 queries.
     *
     * @param formIds identifiers of the forms
     * @return ordered list of questions
     */
    List<Question> findByFormIdInAndActiveTrueOrderByQuestionOrderAsc(Collection<Long> formIds);

    /**
     * Returns every question of a form, active or not.
     *
     * @param formId identifier of the form
     * @return list of questions
     */
    List<Question> findByFormId(Long formId);
}
