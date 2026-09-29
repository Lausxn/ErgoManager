package com.mgs.ergomanager.dto.selfevaluation;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * Answer sent by an employee for a single question.
 *
 * @param questionId     identifier of the answered question
 * @param selectedOption label of the option chosen by the employee
 * @param score          value of the chosen option, from 0 to 3
 */
public record AnswerRequestDTO(

        @NotNull(message = "Este campo es obligatorio.")
        Long questionId,

        @NotBlank(message = "Este campo es obligatorio.")
        @Size(max = 100, message = "Use un máximo de 100 caracteres.")
        String selectedOption,

        @NotNull(message = "Este campo es obligatorio.")
        @Min(value = 0, message = "El puntaje debe estar entre 0 y 3.")
        @Max(value = 3, message = "El puntaje debe estar entre 0 y 3.")
        Integer score) {

    /** Trims the selected option before validation. */
    public AnswerRequestDTO {
        selectedOption = selectedOption == null ? null : selectedOption.trim();
    }
}
