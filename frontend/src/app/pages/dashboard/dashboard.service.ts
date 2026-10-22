import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { DashboardSummary } from '../../shared/models/dashboard.model';

/**
 * HTTP access to the /api/dashboard endpoints.
 */
@Injectable({ providedIn: 'root' })
export class DashboardService {
    private readonly http = inject(HttpClient);

    /**
     * Reads the figures shown on the administrator home page.
     *
     * @returns counters of appointments, companies, users and forms
     */
    getSummary(): Observable<DashboardSummary> {
        return this.http.get<DashboardSummary>(`${environment.apiUrl}/dashboard/summary`);
    }
}
