package com.mgs.ergomanager.dto.personalizedevaluation;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Personalized evaluation exposed by the API. It has no risk level: its content
 * is the diagnosis and recommendation of each question.
 *
 * @param id            identifier of the evaluation
 * @param appointmentId identifier of the attended appointment
 * @param userId        identifier of the ergonomist who wrote it
 * @param employeeName  full name of the evaluated employee
 * @param formId        identifier of the personalized evaluation form used; null for
 *                      evaluations stored before the personalized forms existed
 * @param formTitle     name of the personalized evaluation form used
 * @param reportPath    location of the generated PDF report
 * @param evaluatedAt   moment the evaluation was written
 * @param employeeEmail email of the evaluated employee
 * @param companyName   business name of the company the employee works for
 * @param answerList    diagnosis and recommendation of each question, in order
 */
public record PersonalizedEvaluationResponseDTO(
        Long id,
        Long appointmentId,
        Long userId,
        String employeeName,
        Long formId,
        String formTitle,
        String reportPath,
        LocalDateTime evaluatedAt,
        String employeeEmail,
        String companyName,
        List<PersonalizedAnswerResponseDTO> answerList) {
}
