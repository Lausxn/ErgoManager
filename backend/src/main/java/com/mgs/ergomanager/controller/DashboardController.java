package com.mgs.ergomanager.controller;

import com.mgs.ergomanager.dto.dashboard.DashboardSummaryDTO;
import com.mgs.ergomanager.service.DashboardService;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Counters shown on the administrator dashboard.
 */
@RestController
@RequestMapping("/api/dashboard")
@Tag(name = "Dashboard", description = "Summary counters for the administrator")
public class DashboardController {

    private final DashboardService dashboardService;

    /**
     * Builds the controller with its service.
     *
     * @param dashboardService service that computes the counters
     */
    public DashboardController(DashboardService dashboardService) {
        this.dashboardService = dashboardService;
    }

    /**
     * Returns the upcoming appointments and the active companies, users and forms.
     *
     * @return dashboard counters
     */
    @GetMapping("/summary")
    public ResponseEntity<DashboardSummaryDTO> getSummary() {
        return ResponseEntity.ok(dashboardService.getSummary());
    }
}
