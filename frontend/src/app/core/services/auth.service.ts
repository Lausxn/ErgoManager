import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ChangePasswordRequest, LoginRequest, LoginResponse } from '../../shared/models/auth.model';
import { Role } from '../../shared/models/role.model';

const SESSION_STORAGE_KEY = 'ergomanager.session';

const PREVIEW_SESSION: LoginResponse = {
    token: '',
    tokenType: 'Bearer',
    expiresAtMs: Number.MAX_SAFE_INTEGER,
    userId: 0,
    fullName: 'Vista previa',
    role: 'ERGONOMIST'
};

/** Keeps the signed in session of an administrator or an ergonomist. */
@Injectable({ providedIn: 'root' })
export class AuthService {
    private readonly http = inject(HttpClient);

    readonly isPreviewMode = environment.previewMode;

    private readonly currentSession = signal<LoginResponse | null>(readStoredSession() ?? this.getPreviewSession());

    readonly session = this.currentSession.asReadonly();

    isAuthenticated(): boolean {
        if (this.isPreviewMode) return true;
        const session = this.currentSession();
        return session !== null && session.expiresAtMs > Date.now();
    }

    getHomeUrl(): string {
        return '/dashboard';
    }

    login(request: LoginRequest): Observable<LoginResponse> {
        return this.http.post<LoginResponse>(`${environment.apiUrl}/auth/login`, request).pipe(tap((session) => this.storeSession(session)));
    }

    changePassword(request: ChangePasswordRequest): Observable<LoginResponse> {
        return this.http.put<LoginResponse>(`${environment.apiUrl}/auth/password`, request).pipe(tap((session) => this.storeSession(session)));
    }

    logout(): void {
        localStorage.removeItem(SESSION_STORAGE_KEY);
        this.currentSession.set(this.getPreviewSession());
    }

    getToken(): string | null {
        return this.currentSession()?.token || null;
    }

    hasAnyRole(allowedRoles: readonly Role[]): boolean {
        if (this.isPreviewMode) return true;
        const session = this.currentSession();
        return session !== null && allowedRoles.includes(session.role);
    }

    private getPreviewSession(): LoginResponse | null {
        return this.isPreviewMode ? PREVIEW_SESSION : null;
    }

    private storeSession(session: LoginResponse): void {
        localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
        this.currentSession.set(session);
    }
}

function readStoredSession(): LoginResponse | null {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (raw === null) return null;
    try {
        return JSON.parse(raw) as LoginResponse;
    } catch {
        localStorage.removeItem(SESSION_STORAGE_KEY);
        return null;
    }
}
