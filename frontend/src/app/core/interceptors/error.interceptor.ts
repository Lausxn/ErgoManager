import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

import { getApiErrorMessage } from '../../shared/utils/api-error';
import { AuthService } from '../services/auth.service';

/** Navigation state key the login page reads to explain why the session ended. */
export const SESSION_MESSAGE_STATE_KEY = 'sessionMessage';

const SESSION_ENDED_MESSAGE = 'Su sesión terminó. Inicie sesión nuevamente.';

const UNAUTHORIZED_STATUS = 401;

const FORBIDDEN_STATUS = 403;

/** Wrong credentials also answer 401, and the login page shows its own message for them. */
const LOGIN_URL_SUFFIX = '/auth/login';

/**
 * Signs the user out when the backend rejects the token, opens the access
 * denied page when the role is not enough, and lets every other failure reach
 * the component that made the call.
 */
export const errorInterceptor: HttpInterceptorFn = (request, next) => {
    const authService = inject(AuthService);
    const router = inject(Router);

    return next(request).pipe(
        catchError((error: HttpErrorResponse) => {
            // The preview mode has no token: stay on the page instead of being sent to the login.
            if (authService.isPreviewMode && !authService.getToken()) {
                return throwError(() => error);
            }
            if (error.status === UNAUTHORIZED_STATUS && !request.url.endsWith(LOGIN_URL_SUFFIX)) {
                authService.logout();
                // The login page explains why the session ended, for example because it expired.
                void router.navigate(['/auth/login'], {
                    queryParams: { redirectTo: router.url },
                    state: { [SESSION_MESSAGE_STATE_KEY]: getApiErrorMessage(error, SESSION_ENDED_MESSAGE) }
                });
            } else if (error.status === FORBIDDEN_STATUS) {
                void router.navigate(['/auth/access']);
            }
            return throwError(() => error);
        })
    );
};
