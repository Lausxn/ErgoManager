package com.mgs.ergomanager.controller;

import com.mgs.ergomanager.dto.report.EvaluationReportItemDTO;
import com.mgs.ergomanager.dto.report.ReportCompanyDTO;
import com.mgs.ergomanager.dto.report.ReportEmployeeDTO;
import com.mgs.ergomanager.model.enums.FormType;
import com.mgs.ergomanager.service.ReportService;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Read only endpoints of the evaluation reports, used by administrators and
 * ergonomists to find the stored self evaluations and personalized evaluations.
 */
@RestController
@RequestMapping("/api/reports")
@Tag(name = "Reports", description = "Stored evaluations filtered by company and employee, sorted alphabetically")
public class ReportController {

    private final ReportService reportService;

    /**
     * Builds the controller with its service.
     *
     * @param reportService service that builds the reports
     */
    public ReportController(ReportService reportService) {
        this.reportService = reportService;
    }

    /**
     * Returns the evaluations that match the filters, sorted alphabetically by
     * company, employee name and employee email.
     *
     * @param companyName   part of the business name of the company; every company when missing
     * @param employeeEmail part of the email of the employee; every employee when missing
     * @param type          SELF_EVALUATION or PERSONALIZED_EVALUATION; both when missing
     * @return matching evaluations
     */
    @GetMapping("/evaluations")
    public ResponseEntity<List<EvaluationReportItemDTO>> findEvaluations(
            @RequestParam(required = false) String companyName,
            @RequestParam(required = false) String employeeEmail,
            @RequestParam(required = false) FormType type) {
        return ResponseEntity.ok(reportService.findEvaluations(companyName, employeeEmail, type));
    }

    /**
     * Returns the companies that have evaluated employees, sorted by name, to
     * fill the company filter.
     *
     * @return companies offered as filter
     */
    @GetMapping("/companies")
    public ResponseEntity<List<ReportCompanyDTO>> findCompanies() {
        return ResponseEntity.ok(reportService.findCompanies());
    }

    /**
     * Returns the evaluated employees, sorted by name, to fill the email filter.
     *
     * @param companyId identifier of the company; every company when missing
     * @return employees offered as filter
     */
    @GetMapping("/employees")
    public ResponseEntity<List<ReportEmployeeDTO>> findEmployees(@RequestParam(required = false) Long companyId) {
        return ResponseEntity.ok(reportService.findEmployees(companyId));
    }
}
