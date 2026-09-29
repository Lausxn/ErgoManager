package com.mgs.ergomanager.service;

import com.mgs.ergomanager.dto.dashboard.DashboardSummaryDTO;

/**
 * Counters shown on the administrator dashboard.
 */
public interface DashboardService {

    /**
     * Counts the upcoming appointments and the active companies, users and forms.
     *
     * @return dashboard counters
     */
    DashboardSummaryDTO getSummary();
}
