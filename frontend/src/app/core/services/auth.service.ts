import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';

import { environment } from '../../../environments/environment';
import { LoginRequest, LoginResponse } from '../../shared/models/auth.model';
import { Role } from '../../shared/models/role.model';

const SESSION_STORAGE_KEY = 'ergomanager.session';

/**
 * Demo user of the preview mode (see environment.previewMode). It has no token,
 * so the backend still rejects any protected call.
 */
const PREVIEW_SESSION: LoginResponse = {
    token: '',
    tokenType: 'Bearer',
    expiresAtMs: Number.MAX_SAFE_INTEGER,
    userId: 0,
    fullName: 'Vista previa',
    role: 'ADMIN'
};

/**
 * Keeps the signed in session of an administrator or an ergonomist. It is the
 * only place where the JWT is read from and written to the browser storage.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
    private readonly http = inject(HttpClient);

    /** True while the temporary preview mode lets every page open without signing in. */
    readonly isPreviewMode = environment.previewMode;

    private readonly currentSession = signal<LoginResponse | null>(readStoredSession() ?? this.getPreviewSession());

    /** Session of the signed in user, or null when nobody is signed in. */
    readonly session = this.currentSession.asReadonly();

    /**
     * Checks whether there is a stored session that has not expired. It is a
     * method and not a computed signal, so the expiration is evaluated on every
     * call instead of being cached.
     *
     * @returns true while the session is valid
     */
    isAuthenticated(): boolean {
        if (this.isPreviewMode) {
            return true;
        }
        const session = this.currentSession();
        return session !== null && session.expiresAtMs > Date.now();
    }

    /**
     * Returns the first page of the signed in user, which depends on the role.
     *
     * @returns url of the home page
     */
    getHomeUrl(): string {
        return this.currentSession()?.role === 'ADMIN' ? '/companies' : '/appointments';
    }

    /**
     * Sends the credentials to the backend and stores the returned session.
     *
     * @param request email and password typed by the user
     * @returns the session issued by the backend
     */
    login(request: LoginRequest): Observable<LoginResponse> {
        return this.http.post<LoginResponse>(`${environment.apiUrl}/auth/login`, request).pipe(tap((session) => this.storeSession(session)));
    }

    /**
     * Clears the stored session.
     */
    logout(): void {
        localStorage.removeItem(SESSION_STORAGE_KEY);
        this.currentSession.set(this.getPreviewSession());
    }

    /**
     * Returns the token that the interceptor attaches to every request.
     *
     * @returns the token, or null when nobody is signed in
     */
    getToken(): string | null {
        return this.currentSession()?.token || null;
    }

    /**
     * Checks whether the signed in user holds one of the given roles.
     *
     * @param allowedRoles roles that can reach the feature
     * @returns true when the session matches one of them
     */
    hasAnyRole(allowedRoles: readonly Role[]): boolean {
        if (this.isPreviewMode) {
            return true;
        }
        const session = this.currentSession();
        return session !== null && allowedRoles.includes(session.role);
    }

    /**
     * Returns the demo session when the preview mode is on.
     *
     * @returns the demo session, or null outside the preview mode
     */
    private getPreviewSession(): LoginResponse | null {
        return this.isPreviewMode ? PREVIEW_SESSION : null;
    }

    /**
     * Stores the session both in memory and in the browser, so a page reload
     * does not sign the user out.
     *
     * @param session session returned by the backend
     */
    private storeSession(session: LoginResponse): void {
        localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
        this.currentSession.set(session);
    }
}

/**
 * Reads the session left in the browser by a previous visit.
 *
 * @returns the stored session, or null when there is none or it is unreadable
 */
function readStoredSession(): LoginResponse | null {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (raw === null) {
        return null;
    }
    try {
        return JSON.parse(raw) as LoginResponse;
    } catch {
        localStorage.removeItem(SESSION_STORAGE_KEY);
        return null;
    }
}
