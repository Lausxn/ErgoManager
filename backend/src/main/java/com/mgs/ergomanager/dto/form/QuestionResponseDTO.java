package com.mgs.ergomanager.dto.form;

import java.util.List;

/**
 * Question exposed by the API.
 *
 * @param id            identifier of the question
 * @param statement     text of the question
 * @param questionOrder position of the question inside the form
 * @param active        false when the question was deactivated
 * @param optionList    active predefined answers, ordered; empty for a personalized evaluation
 */
public record QuestionResponseDTO(
        Long id,
        String statement,
        Integer questionOrder,
        boolean active,
        List<AnswerOptionResponseDTO> optionList) {
}
