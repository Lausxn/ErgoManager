package com.mgs.ergomanager.dto.personalizedevaluation;

import com.mgs.ergomanager.model.enums.RiskLevel;
import java.time.LocalDateTime;

/**
 * Personalized evaluation exposed by the API.
 *
 * @param id              identifier of the evaluation
 * @param appointmentId   identifier of the attended appointment
 * @param userId          identifier of the ergonomist who wrote it
 * @param employeeName    full name of the evaluated employee
 * @param diagnosis       findings observed during the appointment
 * @param recommendations actions proposed to reduce the ergonomic risk
 * @param riskLevel       risk level confirmed by the ergonomist
 * @param reportPath      location of the generated PDF report
 * @param evaluatedAt     moment the evaluation was written
 */
public record PersonalizedEvaluationResponse(
        Long id,
        Long appointmentId,
        Long userId,
        String employeeName,
        String diagnosis,
        String recommendations,
        RiskLevel riskLevel,
        String reportPath,
        LocalDateTime evaluatedAt) {
}
