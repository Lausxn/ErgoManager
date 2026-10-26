package com.mgs.ergomanager.dto.personalizedevaluation;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import java.util.List;

/**
 * Data written by the ergonomist after attending an appointment.
 *
 * @param appointmentId identifier of the attended appointment
 * @param formId        identifier of the active personalized evaluation form
 * @param answerList    diagnosis and recommendation of every question of the form
 */
public record PersonalizedEvaluationRequestDTO(

        @NotNull(message = "Este campo es obligatorio.")
        Long appointmentId,

        @NotNull(message = "Este campo es obligatorio.")
        Long formId,

        @NotEmpty(message = "Complete el diagnóstico y la recomendación de todas las preguntas.")
        List<@Valid PersonalizedAnswerRequestDTO> answerList) {
}
