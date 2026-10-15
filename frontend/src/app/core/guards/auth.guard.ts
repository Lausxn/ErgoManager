import { inject } from '@angular/core';
import { CanActivateFn, RedirectCommand, Router } from '@angular/router';

import { SESSION_MESSAGE_STATE_KEY } from '../interceptors/error.interceptor';
import { AuthService } from '../services/auth.service';

/** Same text the backend sends when it receives an expired token. */
export const SESSION_EXPIRED_MESSAGE = 'Su sesión expiró. Inicie sesión nuevamente.';

/**
 * Blocks a route when nobody is signed in and sends the visitor to the login
 * page, keeping the requested url so it can be reopened afterwards. When the
 * session existed but expired, the login page explains it.
 */
export const authGuard: CanActivateFn = (_route, state) => {
    const authService = inject(AuthService);
    const router = inject(Router);

    if (authService.isAuthenticated()) {
        return true;
    }

    const expired = authService.hasExpiredSession();
    authService.logout();
    const loginUrl = router.createUrlTree(['/auth/login'], { queryParams: { redirectTo: state.url } });
    return expired ? new RedirectCommand(loginUrl, { state: { [SESSION_MESSAGE_STATE_KEY]: SESSION_EXPIRED_MESSAGE } }) : loginUrl;
};
