package com.mgs.ergomanager.dto.personalizedevaluation;

import com.mgs.ergomanager.model.enums.RiskLevel;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * Evaluation written by the ergonomist after attending an appointment.
 *
 * @param appointmentId   identifier of the attended appointment
 * @param diagnosis       findings observed during the appointment
 * @param recommendations actions proposed to reduce the ergonomic risk
 * @param riskLevel       risk level confirmed by the ergonomist
 */
public record PersonalizedEvaluationRequestDTO(

        @NotNull(message = "Este campo es obligatorio.")
        Long appointmentId,

        @NotBlank(message = "Este campo es obligatorio.")
        @Size(max = 1000, message = "Use un máximo de 1000 caracteres.")
        String diagnosis,

        @NotBlank(message = "Este campo es obligatorio.")
        @Size(max = 1000, message = "Use un máximo de 1000 caracteres.")
        String recommendations,

        @NotNull(message = "Seleccione un nivel de riesgo.")
        RiskLevel riskLevel) {

    /** Trims the texts before validation. */
    public PersonalizedEvaluationRequestDTO {
        diagnosis = diagnosis == null ? null : diagnosis.trim();
        recommendations = recommendations == null ? null : recommendations.trim();
    }
}
