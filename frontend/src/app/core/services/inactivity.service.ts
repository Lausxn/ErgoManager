import { Injectable, NgZone, OnDestroy, inject } from '@angular/core';
import { Router } from '@angular/router';

import { environment } from '../../../environments/environment';
import { SESSION_MESSAGE_STATE_KEY } from '../interceptors/error.interceptor';
import { AuthService, LAST_ACTIVITY_STORAGE_KEY } from './auth.service';

/** Message the login page shows after an automatic sign out. */
export const INACTIVITY_MESSAGE = 'Su sesión se cerró por inactividad. Inicie sesión nuevamente.';

/** How often the time without activity is checked. */
const CHECK_INTERVAL_MS = 5000;

/** Minimum time between two writes of the activity, so moving the mouse does not write on every event. */
const WRITE_THROTTLE_MS = 2000;

const ACTIVITY_EVENTS = ['click', 'keydown', 'mousemove', 'scroll', 'touchstart'] as const;

/**
 * Closes the session after environment.inactivityTimeoutMs without clicks,
 * keys or scroll. The time of the last activity lives in the browser storage,
 * so every open tab shares it and a reload does not reset it. The main layout
 * starts it, so it only runs while somebody is signed in.
 */
@Injectable({ providedIn: 'root' })
export class InactivityService implements OnDestroy {
    private readonly authService = inject(AuthService);
    private readonly router = inject(Router);
    private readonly zone = inject(NgZone);
    private intervalId: ReturnType<typeof setInterval> | null = null;
    private lastWrite = 0;
    private readonly onActivity = (): void => this.recordActivity();

    /** Starts watching the activity of the signed in user. */
    start(): void {
        if (this.intervalId !== null || this.authService.isPreviewMode) {
            return;
        }
        if (readLastActivity() === null) {
            this.recordActivity();
        }
        // Outside Angular, so the events and the timer do not trigger change detection.
        this.zone.runOutsideAngular(() => {
            ACTIVITY_EVENTS.forEach((event) => document.addEventListener(event, this.onActivity, { passive: true }));
            this.intervalId = setInterval(() => this.checkInactivity(), CHECK_INTERVAL_MS);
        });
        this.checkInactivity();
    }

    /** Stops watching, for example when the layout is destroyed after signing out. */
    stop(): void {
        ACTIVITY_EVENTS.forEach((event) => document.removeEventListener(event, this.onActivity));
        if (this.intervalId !== null) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }

    ngOnDestroy(): void {
        this.stop();
    }

    /**
     * Signs the user out when the time without activity exceeds the limit.
     * Called by the timer; also public so the tests can run it directly.
     */
    checkInactivity(): void {
        const lastActivity = readLastActivity();
        if (lastActivity === null || Date.now() - lastActivity < environment.inactivityTimeoutMs) {
            return;
        }
        this.stop();
        this.zone.run(() => {
            const redirectTo = this.router.url;
            this.authService.logout();
            void this.router.navigate(['/auth/login'], { queryParams: { redirectTo }, state: { [SESSION_MESSAGE_STATE_KEY]: INACTIVITY_MESSAGE } });
        });
    }

    private recordActivity(): void {
        const now = Date.now();
        if (now - this.lastWrite >= WRITE_THROTTLE_MS) {
            this.lastWrite = now;
            localStorage.setItem(LAST_ACTIVITY_STORAGE_KEY, String(now));
        }
    }
}

/**
 * Reads the time of the last activity of any open tab.
 *
 * @returns milliseconds since epoch, or null when it was never recorded
 */
function readLastActivity(): number | null {
    const value = Number(localStorage.getItem(LAST_ACTIVITY_STORAGE_KEY));
    return Number.isFinite(value) && value > 0 ? value : null;
}
