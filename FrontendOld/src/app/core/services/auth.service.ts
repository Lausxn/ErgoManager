import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';

import { environment } from '../../../environments/environment';
import { LoginRequest, LoginResponse } from '../../shared/models/auth.model';
import { Role } from '../../shared/models/role.model';

const SESSION_STORAGE_KEY = 'ergomanager.session';

/**
 * Keeps the signed in session of an administrator or an ergonomist. It is the
 * only place where the JWT is read from and written to the browser storage.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);

  private readonly currentSession = signal<LoginResponse | null>(readStoredSession());

  /** Session of the signed in user, or null when nobody is signed in. */
  readonly session = this.currentSession.asReadonly();

  /** True while there is a stored session that has not expired. */
  readonly isAuthenticated = computed(() => {
    const session = this.currentSession();
    return session !== null && session.expiresAtMs > Date.now();
  });

  /**
   * Sends the credentials to the backend and stores the returned session.
   *
   * @param request email and password typed by the user
   * @returns the session issued by the backend
   */
  login(request: LoginRequest): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(`${environment.apiUrl}/auth/login`, request)
      .pipe(tap((session) => this.storeSession(session)));
  }

  /**
   * Clears the stored session.
   */
  logout(): void {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    this.currentSession.set(null);
  }

  /**
   * Returns the token that the interceptor attaches to every request.
   *
   * @returns the token, or null when nobody is signed in
   */
  getToken(): string | null {
    return this.currentSession()?.token ?? null;
  }

  /**
   * Checks whether the signed in user holds one of the given roles.
   *
   * @param allowedRoles roles that can reach the feature
   * @returns true when the session matches one of them
   */
  hasAnyRole(allowedRoles: readonly Role[]): boolean {
    const session = this.currentSession();
    return session !== null && allowedRoles.includes(session.role);
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
