package com.mgs.ergomanager.dto.selfevaluation;

/**
 * Answer exposed by the API.
 *
 * @param id             identifier of the answer
 * @param questionId     identifier of the answered question
 * @param statement      text of the answered question
 * @param optionId       identifier of the chosen predefined answer; null for answers stored
 *                       before the predefined answers existed
 * @param selectedOption text of the chosen answer, as it was when the employee answered
 * @param score          weight of the chosen answer, from 1 to 3, as it was when the employee answered
 */
public record AnswerResponseDTO(
        Long id,
        Long questionId,
        String statement,
        Long optionId,
        String selectedOption,
        Integer score) {
}
