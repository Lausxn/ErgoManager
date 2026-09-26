import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { UserRequest, UserResponse } from '../../shared/models/user.model';

/**
 * HTTP access to the /api/users endpoints.
 */
@Injectable({ providedIn: 'root' })
export class UserService {
    private readonly http = inject(HttpClient);

    private readonly baseUrl = `${environment.apiUrl}/users`;

    /**
     * Reads every registered user.
     *
     * @returns list of users
     */
    findAll(): Observable<UserResponse[]> {
        return this.http.get<UserResponse[]>(this.baseUrl);
    }

    /**
     * Reads a single user.
     *
     * @param id identifier of the user
     * @returns the user
     */
    findById(id: number): Observable<UserResponse> {
        return this.http.get<UserResponse>(`${this.baseUrl}/${id}`);
    }

    /**
     * Registers a new administrator or ergonomist.
     *
     * @param request data typed in the form
     * @returns the created user
     */
    create(request: UserRequest): Observable<UserResponse> {
        return this.http.post<UserResponse>(this.baseUrl, request);
    }

    /**
     * Updates an existing user.
     *
     * @param id      identifier of the user
     * @param request data typed in the form
     * @returns the updated user
     */
    update(id: number, request: UserRequest): Observable<UserResponse> {
        return this.http.put<UserResponse>(`${this.baseUrl}/${id}`, request);
    }

    /**
     * Deactivates a user so it can no longer sign in.
     *
     * @param id identifier of the user
     * @returns an empty response
     */
    deactivate(id: number): Observable<void> {
        return this.http.delete<void>(`${this.baseUrl}/${id}`);
    }
}
