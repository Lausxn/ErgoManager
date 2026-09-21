import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  PersonalizedEvaluationRequest,
  PersonalizedEvaluationResponse,
} from '../../shared/models/personalized-evaluation.model';

/**
 * HTTP access to the /api/personalized-evaluations endpoints.
 */
@Injectable({ providedIn: 'root' })
export class PersonalizedEvaluationService {
  private readonly http = inject(HttpClient);

  private readonly baseUrl = `${environment.apiUrl}/personalized-evaluations`;

  /**
   * Stores the evaluation written after an appointment.
   *
   * @param request data typed by the ergonomist
   * @returns the stored evaluation
   */
  create(request: PersonalizedEvaluationRequest): Observable<PersonalizedEvaluationResponse> {
    return this.http.post<PersonalizedEvaluationResponse>(this.baseUrl, request);
  }

  /**
   * Reads a single evaluation.
   *
   * @param id identifier of the evaluation
   * @returns the evaluation
   */
  findById(id: number): Observable<PersonalizedEvaluationResponse> {
    return this.http.get<PersonalizedEvaluationResponse>(`${this.baseUrl}/${id}`);
  }

  /**
   * Reads the evaluations written by an ergonomist.
   *
   * @param userId identifier of the ergonomist
   * @returns list of evaluations
   */
  findByErgonomist(userId: number): Observable<PersonalizedEvaluationResponse[]> {
    return this.http.get<PersonalizedEvaluationResponse[]>(this.baseUrl, { params: { userId } });
  }

  /**
   * Downloads the PDF report of an evaluation.
   *
   * @param id identifier of the evaluation
   * @returns the PDF file as a blob
   */
  downloadReport(id: number): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/${id}/report`, { responseType: 'blob' });
  }
}
