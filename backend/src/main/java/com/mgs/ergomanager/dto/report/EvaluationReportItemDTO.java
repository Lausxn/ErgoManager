package com.mgs.ergomanager.dto.report;

import com.mgs.ergomanager.model.enums.FormType;
import com.mgs.ergomanager.model.enums.RiskLevel;
import java.time.LocalDateTime;
import java.util.List;

/**
 * Row of the evaluation report: a self evaluation or a personalized evaluation
 * of an employee, with the data needed to filter, sort and open it.
 *
 * @param type             SELF_EVALUATION or PERSONALIZED_EVALUATION
 * @param evaluationId     identifier of the self evaluation or of the personalized evaluation
 * @param selfEvaluationId identifier of the self evaluation; for a personalized evaluation,
 *                         the self evaluation that led to the appointment
 * @param companyId        identifier of the company of the employee
 * @param companyName      current business name of the company of the employee
 * @param previousCompanyNames names the company used before, the most recent first; the
 *                         company filter also finds the evaluation by them
 * @param employeeName     full name of the employee
 * @param employeeEmail    email of the employee
 * @param employeePosition job position of the employee
 * @param formId           identifier of the form used; null for personalized evaluations
 *                         stored before the personalized forms existed
 * @param formTitle        name of the form used
 * @param evaluatedAt      moment the self evaluation was sent or the personalized evaluation written
 * @param riskLevel        risk level of a self evaluation; null for a personalized evaluation
 * @param riskPercentage   risk percentage of a self evaluation; null for a personalized evaluation
 *                         and for self evaluations stored before the percentage existed
 * @param ergonomistName   full name of the ergonomist of a personalized evaluation; null for a
 *                         self evaluation
 * @param detailPath       endpoint that returns the full evaluation with its answers
 * @param reportPath       endpoint of the PDF report of a personalized evaluation; null for a
 *                         self evaluation
 */
public record EvaluationReportItemDTO(
        FormType type,
        Long evaluationId,
        Long selfEvaluationId,
        Long companyId,
        String companyName,
        List<String> previousCompanyNames,
        String employeeName,
        String employeeEmail,
        String employeePosition,
        Long formId,
        String formTitle,
        LocalDateTime evaluatedAt,
        RiskLevel riskLevel,
        Double riskPercentage,
        String ergonomistName,
        String detailPath,
        String reportPath) {
}
