package com.mgs.ergomanager.service;

import com.mgs.ergomanager.dto.report.EvaluationReportItemDTO;
import com.mgs.ergomanager.dto.report.ReportCompanyDTO;
import com.mgs.ergomanager.dto.report.ReportEmployeeDTO;
import com.mgs.ergomanager.model.enums.FormType;
import java.util.List;

/**
 * Reports of the stored self evaluations and personalized evaluations, filtered
 * by company and employee and sorted alphabetically.
 */
public interface ReportService {

    /**
     * Returns the evaluations that match the filters, sorted by company name,
     * then employee name, then employee email, and newest first for the same
     * employee. The texts are compared ignoring case and accents. An ergonomist
     * only receives their own personalized evaluations.
     *
     * @param companyName   part of the current or a previous business name of the company, or null
     *                      for every company
     * @param employeeEmail part of the email of the employee, or null for every employee
     * @param type          type of evaluation, or null for both
     * @return matching evaluations
     */
    List<EvaluationReportItemDTO> findEvaluations(String companyName, String employeeEmail, FormType type);

    /**
     * Returns the companies that have evaluated employees, sorted by name.
     *
     * @return companies offered as filter
     */
    List<ReportCompanyDTO> findCompanies();

    /**
     * Returns the evaluated employees, sorted by name and then email.
     *
     * @param companyId identifier of the company, or null for every company
     * @return employees offered as filter
     */
    List<ReportEmployeeDTO> findEmployees(Long companyId);
}
