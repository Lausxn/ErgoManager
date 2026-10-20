package com.mgs.ergomanager.dto.report;

/**
 * Company offered as a filter of the evaluation report.
 *
 * @param id           identifier of the company
 * @param businessName business name of the company
 * @param active       false when the company was deactivated; its evaluations are kept
 */
public record ReportCompanyDTO(
        Long id,
        String businessName,
        boolean active) {
}
