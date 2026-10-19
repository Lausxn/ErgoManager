package com.mgs.ergomanager.dto.selfevaluation;

import com.mgs.ergomanager.model.enums.RiskLevel;
import java.time.LocalDateTime;
import java.util.List;

/**
 * Self evaluation exposed by the API, including the calculated risk level.
 *
 * @param id               identifier of the self evaluation
 * @param formId           identifier of the answered form
 * @param companyId        identifier of the company the employee works for
 * @param employeeName     full name of the employee
 * @param employeeEmail    email used to contact the employee
 * @param employeePosition job position of the employee
 * @param totalScore       sum of the weights of the chosen answers
 * @param averageScore     average weight per question, from 1 to 3, rounded to two decimals
 * @param riskPercentage   position of the average in the 1 to 3 scale, from 0 to 100,
 *                         rounded to two decimals
 * @param riskLevel        risk level derived from the average: LOW, MEDIUM or HIGH
 * @param submittedAt      moment the self evaluation was submitted
 * @param answerList       answers given to every question of the form
 */
public record SelfEvaluationResponseDTO(
        Long id,
        Long formId,
        Long companyId,
        String employeeName,
        String employeeEmail,
        String employeePosition,
        Integer totalScore,
        Double averageScore,
        Double riskPercentage,
        RiskLevel riskLevel,
        LocalDateTime submittedAt,
        List<AnswerResponseDTO> answerList) {
}
