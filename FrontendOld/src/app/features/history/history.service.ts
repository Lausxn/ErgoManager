import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { HistoryResponse } from '../../shared/models/history.model';

/**
 * HTTP access to the /api/histories endpoints.
 */
@Injectable({ providedIn: 'root' })
export class HistoryService {
  private readonly http = inject(HttpClient);

  private readonly baseUrl = `${environment.apiUrl}/histories`;

  /**
   * Reads the history entries of a client company, newest first.
   *
   * @param companyId identifier of the company
   * @returns list of history entries
   */
  findByCompany(companyId: number): Observable<HistoryResponse[]> {
    return this.http.get<HistoryResponse[]>(this.baseUrl, { params: { companyId } });
  }

  /**
   * Reads the history entries of an employee, newest first.
   *
   * @param employeeEmail email of the employee
   * @returns list of history entries
   */
  findByEmployee(employeeEmail: string): Observable<HistoryResponse[]> {
    return this.http.get<HistoryResponse[]>(
      `${this.baseUrl}/employees/${encodeURIComponent(employeeEmail)}`,
    );
  }
}
