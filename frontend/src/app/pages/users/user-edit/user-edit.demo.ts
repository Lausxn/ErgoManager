/*
 * TEMPORARY: sample data to review the edit page without the backend, served
 * at /users/user-edit/testUserId. Delete this file and its route in
 * users.routes.ts once the page is reviewed.
 *
 * To see the error messages:
 * - Email duplicado@mgs.com answers 409 (email already registered).
 * - Changing the role to Ergonomista answers 400 (only active administrator).
 */
import { HttpErrorResponse, HttpStatusCode } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, delay, of, throwError } from 'rxjs';

import { UserResponse, UserUpdateRequest } from '../../../shared/models/user.model';

const DEMO_DELAY_MS = 600;

export const DEMO_USER_ID = 999;

const DEMO_USER: UserResponse = {
    id: DEMO_USER_ID,
    firstName: 'María Fernanda',
    firstLastName: 'Madrigal',
    secondLastName: 'Solano',
    email: 'maria.madrigal@mgs.com',
    role: 'ADMIN',
    active: true,
    createdAt: '2026-09-15T09:30:00'
};

/** Replaces UserService on the demo route only. */
@Injectable()
export class DemoUserService {
    findById(): Observable<UserResponse> {
        return of(DEMO_USER).pipe(delay(DEMO_DELAY_MS));
    }

    update(_id: number, request: UserUpdateRequest): Observable<UserResponse> {
        if (request.email === 'duplicado@mgs.com') {
            return this.fail(HttpStatusCode.Conflict);
        }
        if (request.role === 'ERGONOMIST') {
            return this.fail(HttpStatusCode.BadRequest);
        }
        return of({ ...DEMO_USER, ...request }).pipe(delay(DEMO_DELAY_MS));
    }

    private fail(status: number): Observable<never> {
        return throwError(() => new HttpErrorResponse({ status })).pipe(delay(DEMO_DELAY_MS));
    }
}
