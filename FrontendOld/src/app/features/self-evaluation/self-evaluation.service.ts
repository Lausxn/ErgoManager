import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  SelfEvaluationRequest,
  SelfEvaluationResponse,
} from '../../shared/models/self-evaluation.model';

/**
 * HTTP access to the /api/self-evaluations endpoints.
 */
@Injectable({ providedIn: 'root' })
export class SelfEvaluationService {
  private readonly http = inject(HttpClient);

  private readonly baseUrl = `${environment.apiUrl}/self-evaluations`;

  /**
   * Submits the answers of an employee. This endpoint is public.
   *
   * @param request answers typed in the form
   * @returns the stored self evaluation, including its risk level
   */
  submit(request: SelfEvaluationRequest): Observable<SelfEvaluationResponse> {
    return this.http.post<SelfEvaluationResponse>(this.baseUrl, request);
  }

  /**
   * Reads a single self evaluation with its answers.
   *
   * @param id identifier of the self evaluation
   * @returns the self evaluation
   */
  findById(id: number): Observable<SelfEvaluationResponse> {
    return this.http.get<SelfEvaluationResponse>(`${this.baseUrl}/${id}`);
  }

  /**
   * Reads the self evaluations submitted by the employees of a company.
   *
   * @param companyId identifier of the company
   * @returns list of self evaluations
   */
  findByCompany(companyId: number): Observable<SelfEvaluationResponse[]> {
    return this.http.get<SelfEvaluationResponse[]>(this.baseUrl, { params: { companyId } });
  }
}
