package com.mgs.ergomanager.dto.form;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Self evaluation form exposed by the API.
 *
 * @param id              identifier of the form
 * @param title           title shown to the employee
 * @param description     short explanation of the purpose of the form
 * @param publicationYear year the form was published for
 * @param active          false when the form was deactivated
 * @param createdAt       moment the form was created
 * @param questionList    questions that make up the form
 */
public record FormResponseDTO(
        Long id,
        String title,
        String description,
        Integer publicationYear,
        boolean active,
        LocalDateTime createdAt,
        List<QuestionResponseDTO> questionList) {
}
