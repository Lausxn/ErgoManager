package com.mgs.ergomanager.dto.form;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * Question that is sent together with its form.
 *
 * @param id            identifier of an existing question of the form, null for a new question
 * @param statement     text shown to the employee
 * @param questionOrder position of the question inside the form
 * @param weight        multiplier applied to the answer score
 */
public record QuestionRequestDTO(

        Long id,

        @NotBlank(message = "Este campo es obligatorio.")
        @Size(max = 500, message = "Use un máximo de 500 caracteres.")
        String statement,

        @NotNull(message = "Este campo es obligatorio.")
        @Min(value = 1, message = "El orden debe ser 1 o mayor.")
        Integer questionOrder,

        @NotNull(message = "Este campo es obligatorio.")
        @Min(value = 1, message = "El peso debe ser 1 o mayor.")
        Integer weight) {

    /** Trims the statement before validation. */
    public QuestionRequestDTO {
        statement = statement == null ? null : statement.trim();
    }
}
