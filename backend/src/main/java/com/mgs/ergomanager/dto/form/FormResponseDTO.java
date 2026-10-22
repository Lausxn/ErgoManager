package com.mgs.ergomanager.dto.form;

import com.mgs.ergomanager.model.enums.FormType;
import java.time.LocalDateTime;
import java.util.List;

/**
 * Form exposed by the API.
 *
 * @param id              identifier of the form
 * @param title           name used to recognize the form
 * @param description     short explanation of the purpose of the form
 * @param publicationYear year the form was published for
 * @param type            self evaluation or personalized evaluation
 * @param active          false when the form was deactivated
 * @param createdAt       moment the form was created
 * @param questionList    questions that make up the form
 */
public record FormResponseDTO(
        Long id,
        String title,
        String description,
        Integer publicationYear,
        FormType type,
        boolean active,
        LocalDateTime createdAt,
        List<QuestionResponseDTO> questionList) {
}
