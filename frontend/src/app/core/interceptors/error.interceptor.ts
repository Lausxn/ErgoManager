import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

import { AuthService } from '../services/auth.service';

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
                void router.navigate(['/auth/login'], { queryParams: { redirectTo: router.url } });
            } else if (error.status === FORBIDDEN_STATUS) {
                void router.navigate(['/auth/access']);
            }
            return throwError(() => error);
        })
    );
};
