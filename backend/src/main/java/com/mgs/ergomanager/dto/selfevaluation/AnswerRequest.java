package com.mgs.ergomanager.dto.selfevaluation;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * Answer sent by an employee for a single question.
 *
 * @param questionId     identifier of the answered question
 * @param selectedOption label of the option chosen by the employee
 * @param score          value of the chosen option
 */
public record AnswerRequest(

        @NotNull
        Long questionId,

        @NotBlank
        @Size(max = 100)
        String selectedOption,

        @NotNull
        @Min(0)
        Integer score) {
}
