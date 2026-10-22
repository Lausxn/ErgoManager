package com.mgs.ergomanager.dto.personalizedevaluation;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * Diagnosis and recommendation written by the ergonomist for one question.
 *
 * @param questionId     identifier of the question of the personalized evaluation form
 * @param diagnosis      findings observed by the ergonomist for the question
 * @param recommendation action proposed by the ergonomist for the question
 */
public record PersonalizedAnswerRequestDTO(

        @NotNull(message = "Este campo es obligatorio.")
        Long questionId,

        @NotBlank(message = "Este campo es obligatorio.")
        @Size(max = 1000, message = "Use un máximo de 1000 caracteres.")
        String diagnosis,

        @NotBlank(message = "Este campo es obligatorio.")
        @Size(max = 1000, message = "Use un máximo de 1000 caracteres.")
        String recommendation) {

    /** Trims the texts before validation. */
    public PersonalizedAnswerRequestDTO {
        diagnosis = diagnosis == null ? null : diagnosis.trim();
        recommendation = recommendation == null ? null : recommendation.trim();
    }
}
