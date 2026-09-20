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
public record PersonalizedEvaluationRequest(

        @NotNull
        Long appointmentId,

        @NotBlank
        @Size(max = 1000)
        String diagnosis,

        @NotBlank
        @Size(max = 1000)
        String recommendations,

        @NotNull
        RiskLevel riskLevel) {
}
