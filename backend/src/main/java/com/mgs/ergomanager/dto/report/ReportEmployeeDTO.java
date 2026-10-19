package com.mgs.ergomanager.dto.report;

/**
 * Evaluated employee offered as a filter of the evaluation report.
 *
 * @param employeeEmail email of the employee
 * @param employeeName  full name of the employee, as written in their latest self evaluation
 * @param companyId     identifier of the company of the employee
 * @param companyName   business name of the company of the employee
 */
public record ReportEmployeeDTO(
        String employeeEmail,
        String employeeName,
        Long companyId,
        String companyName) {
}
