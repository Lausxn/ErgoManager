/** Figures of the administrator home page, returned by GET /api/dashboard/summary. */
export interface DashboardSummary {
    scheduledAppointments: number;
    activeCompanies: number;
    activeUsers: number;
    activeForms: number;
}
