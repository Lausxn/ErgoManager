import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { FormRequest, FormResponse } from '../../shared/models/form.model';

/**
 * HTTP access to the /api/forms endpoints.
 */
@Injectable({ providedIn: 'root' })
export class FormService {
  private readonly http = inject(HttpClient);

  private readonly baseUrl = `${environment.apiUrl}/forms`;

  /**
   * Reads every form, active or not.
   *
   * @returns list of forms
   */
  findAll(): Observable<FormResponse[]> {
    return this.http.get<FormResponse[]>(this.baseUrl);
  }

  /**
   * Reads the forms that can currently be answered. This endpoint is public.
   *
   * @returns list of active forms
   */
  findActive(): Observable<FormResponse[]> {
    return this.http.get<FormResponse[]>(`${this.baseUrl}/active`);
  }

  /**
   * Reads a single form with its questions.
   *
   * @param id identifier of the form
   * @returns the form
   */
  findById(id: number): Observable<FormResponse> {
    return this.http.get<FormResponse>(`${this.baseUrl}/${id}`);
  }

  /**
   * Creates a form together with its questions.
   *
   * @param request data typed in the editor
   * @returns the created form
   */
  create(request: FormRequest): Observable<FormResponse> {
    return this.http.post<FormResponse>(this.baseUrl, request);
  }

  /**
   * Updates a form and its questions.
   *
   * @param id      identifier of the form
   * @param request data typed in the editor
   * @returns the updated form
   */
  update(id: number, request: FormRequest): Observable<FormResponse> {
    return this.http.put<FormResponse>(`${this.baseUrl}/${id}`, request);
  }

  /**
   * Deactivates a form so it is no longer offered to the employees.
   *
   * @param id identifier of the form
   * @returns an empty response
   */
  deactivate(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  /**
   * Sends a form again to the employees of a company, as the yearly follow up.
   *
   * @param id        identifier of the form
   * @param companyId identifier of the company to notify
   * @returns an empty response
   */
  resendAnnually(id: number, companyId: number): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/${id}/resend/${companyId}`, {});
  }
}
