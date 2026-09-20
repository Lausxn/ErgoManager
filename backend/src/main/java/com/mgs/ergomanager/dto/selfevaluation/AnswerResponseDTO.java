package com.mgs.ergomanager.dto.selfevaluation;

/**
 * Answer exposed by the API.
 *
 * @param id             identifier of the answer
 * @param questionId     identifier of the answered question
 * @param statement      text of the answered question
 * @param selectedOption label of the option chosen by the employee
 * @param score          value of the chosen option
 */
public record AnswerResponseDTO(
        Long id,
        Long questionId,
        String statement,
        String selectedOption,
        Integer score) {
}
