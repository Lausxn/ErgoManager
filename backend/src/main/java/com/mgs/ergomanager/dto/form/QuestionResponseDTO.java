package com.mgs.ergomanager.dto.form;

/**
 * Question exposed by the API.
 *
 * @param id            identifier of the question
 * @param statement     text shown to the employee
 * @param questionOrder position of the question inside the form
 * @param weight        multiplier applied to the answer score
 * @param active        false when the question was deactivated
 */
public record QuestionResponse(
        Long id,
        String statement,
        Integer questionOrder,
        Integer weight,
        boolean active) {
}
