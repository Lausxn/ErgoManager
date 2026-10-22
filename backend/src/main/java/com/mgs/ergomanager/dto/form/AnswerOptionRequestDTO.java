package com.mgs.ergomanager.dto.form;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * Predefined answer sent together with a self evaluation question.
 *
 * @param id          identifier of an existing option of the question, null for a new option
 * @param label       text of the answer shown to the employee
 * @param weight      risk weight: 1 low or no risk, 2 moderate risk, 3 high risk
 * @param optionOrder position of the answer inside the question
 */
public record AnswerOptionRequestDTO(

        Long id,

        @NotBlank(message = "Este campo es obligatorio.")
        @Size(max = 100, message = "Use un máximo de 100 caracteres.")
        String label,

        @NotNull(message = "Este campo es obligatorio.")
        @Min(value = 1, message = "El peso debe estar entre 1 y 3.")
        @Max(value = 3, message = "El peso debe estar entre 1 y 3.")
        Integer weight,

        @NotNull(message = "Este campo es obligatorio.")
        @Min(value = 1, message = "El orden debe ser 1 o mayor.")
        Integer optionOrder) {

    /** Trims the label before validation. */
    public AnswerOptionRequestDTO {
        label = label == null ? null : label.trim();
    }
}
