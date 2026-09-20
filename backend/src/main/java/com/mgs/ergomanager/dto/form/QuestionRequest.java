package com.mgs.ergomanager.dto.form;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * Question that is sent together with its form.
 *
 * @param statement     text shown to the employee
 * @param questionOrder position of the question inside the form
 * @param weight        multiplier applied to the answer score
 */
public record QuestionRequest(

        @NotBlank
        @Size(max = 500)
        String statement,

        @NotNull
        @Min(1)
        Integer questionOrder,

        @NotNull
        @Min(1)
        Integer weight) {
}
