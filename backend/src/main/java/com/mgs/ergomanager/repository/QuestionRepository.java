package com.mgs.ergomanager.repository;

import com.mgs.ergomanager.model.Question;
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
}
