package com.mgs.ergomanager.dto.report;

import java.util.List;

/**
 * Company offered as a filter of the evaluation report.
 *
 * @param id           identifier of the company
 * @param businessName current business name of the company
 * @param active       false when the company was deactivated; its evaluations are kept
 * @param previousNames names the company used before, the most recent first
 */
public record ReportCompanyDTO(
        Long id,
        String businessName,
        boolean active,
        List<String> previousNames) {
}
