import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { AppointmentRequest, AppointmentRescheduleRequest, AppointmentResponse, AvailabilityRequest, AvailabilityResponse } from '../../shared/models/appointment.model';

/**
 * HTTP access to the /api/appointments endpoints, both for the availability of
 * the ergonomists and for the appointments booked on it.
 */
@Injectable({ providedIn: 'root' })
export class AppointmentService {
    private readonly http = inject(HttpClient);
    private readonly baseUrl = `${environment.apiUrl}/appointments`;

    /**
     * Publishes a new time slot for an ergonomist.
     *
     * @param request data typed in the form
     * @returns the created slot
     */
    createAvailability(request: AvailabilityRequest): Observable<AvailabilityResponse> {
        return this.http.post<AvailabilityResponse>(`${this.baseUrl}/availabilities`, request);
    }

    /**
     * Reads the free slots of an ergonomist inside a date range.
     *
     * @param userId identifier of the ergonomist
     * @param from   beginning of the range, in ISO 8601
     * @param to     end of the range, in ISO 8601
     * @returns list of free slots
     */
    findFreeAvailabilities(userId: number, from: string, to: string): Observable<AvailabilityResponse[]> {
        return this.http.get<AvailabilityResponse[]>(`${this.baseUrl}/availabilities`, {
            params: { userId, from, to }
        });
    }

    /**
     * Books an appointment on a free slot.
     *
     * @param request slot chosen by the employee
     * @returns the booked appointment
     */
    book(request: AppointmentRequest): Observable<AppointmentResponse> {
        return this.http.post<AppointmentResponse>(this.baseUrl, request);
    }

    /**
     * Reads the agenda of an ergonomist inside a date range.
     *
     * @param userId identifier of the ergonomist
     * @param from   beginning of the range, in ISO 8601
     * @param to     end of the range, in ISO 8601
     * @returns list of appointments
     */
    findAgenda(userId: number, from: string, to: string): Observable<AppointmentResponse[]> {
        return this.http.get<AppointmentResponse[]>(this.baseUrl, { params: { userId, from, to } });
    }

    /**
     * Cancels an appointment and frees its slot.
     *
     * @param id identifier of the appointment
     * @returns the cancelled appointment
     */
    cancel(id: number): Observable<AppointmentResponse> {
        return this.http.patch<AppointmentResponse>(`${this.baseUrl}/${id}/cancel`, {});
    }

    /**
     * Removes a published slot that nobody booked yet.
     *
     * @param id identifier of the slot
     * @returns an empty response
     */
    deleteAvailability(id: number): Observable<void> {
        return this.http.delete<void>(`${this.baseUrl}/availabilities/${id}`);
    }

    /**
     * Reads a single time slot, with its current state.
     *
     * @param id identifier of the slot
     * @returns the slot
     */
    findAvailabilityById(id: number): Observable<AvailabilityResponse> {
        return this.http.get<AvailabilityResponse>(`${this.baseUrl}/availabilities/${id}`);
    }

    /**
     * Changes the date and time of a slot that has not been booked.
     *
     * @param id      identifier of the slot
     * @param request new date and time, with the same ergonomist
     * @returns the updated slot
     */
    updateAvailability(id: number, request: AvailabilityRequest): Observable<AvailabilityResponse> {
        return this.http.put<AvailabilityResponse>(`${this.baseUrl}/availabilities/${id}`, request);
    }

    /**
     * Moves a pending appointment to another free slot of the same ergonomist.
     *
     * @param id      identifier of the appointment
     * @param request slot the appointment moves to
     * @returns the rescheduled appointment
     */
    reschedule(id: number, request: AppointmentRescheduleRequest): Observable<AppointmentResponse> {
        return this.http.patch<AppointmentResponse>(`${this.baseUrl}/${id}/reschedule`, request);
    }
}
