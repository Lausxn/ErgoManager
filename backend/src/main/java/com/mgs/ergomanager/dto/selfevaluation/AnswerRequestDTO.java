package com.mgs.ergomanager.dto.selfevaluation;

import jakarta.validation.constraints.NotNull;

/**
 * Answer sent by an employee for a single question. The weight of the chosen
 * option is read from the form, never from the client.
 *
 * @param questionId identifier of the answered question
 * @param optionId   identifier of the predefined answer chosen by the employee
 */
public record AnswerRequestDTO(

        @NotNull(message = "Este campo es obligatorio.")
        Long questionId,

        @NotNull(message = "Seleccione una respuesta.")
        Long optionId) {
}
