import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { CompanyRequest, CompanyResponse } from '../../shared/models/company.model';

/**
 * HTTP access to the /api/companies endpoints.
 */
@Injectable({ providedIn: 'root' })
export class CompanyService {
  private readonly http = inject(HttpClient);

  private readonly baseUrl = `${environment.apiUrl}/companies`;

  /**
   * Reads every registered company.
   *
   * @returns list of companies
   */
  findAll(): Observable<CompanyResponse[]> {
    return this.http.get<CompanyResponse[]>(this.baseUrl);
  }

  /**
   * Reads a single company.
   *
   * @param id identifier of the company
   * @returns the company
   */
  findById(id: number): Observable<CompanyResponse> {
    return this.http.get<CompanyResponse>(`${this.baseUrl}/${id}`);
  }

  /**
   * Registers a new company.
   *
   * @param request data typed in the form
   * @returns the created company
   */
  create(request: CompanyRequest): Observable<CompanyResponse> {
    return this.http.post<CompanyResponse>(this.baseUrl, request);
  }

  /**
   * Updates an existing company.
   *
   * @param id      identifier of the company
   * @param request data typed in the form
   * @returns the updated company
   */
  update(id: number, request: CompanyRequest): Observable<CompanyResponse> {
    return this.http.put<CompanyResponse>(`${this.baseUrl}/${id}`, request);
  }

  /**
   * Deactivates a company without deleting its evaluation history.
   *
   * @param id identifier of the company
   * @returns an empty response
   */
  deactivate(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
