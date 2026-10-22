package com.mgs.ergomanager.dto.dashboard;

/**
 * Counters shown on the administrator dashboard.
 *
 * @param scheduledAppointments upcoming appointments that are scheduled or confirmed
 * @param activeCompanies       client companies that have not been deactivated
 * @param activeUsers           users that can sign in
 * @param activeForms           forms that can currently be answered
 */
public record DashboardSummaryDTO(
        long scheduledAppointments,
        long activeCompanies,
        long activeUsers,
        long activeForms) {
}
