import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

import { AuthService } from '../services/auth.service';

const UNAUTHORIZED_STATUS = 401;
const FORBIDDEN_STATUS = 403;

/** Wrong credentials also answer 401, and login handles those itself. */
const LOGIN_URL_SUFFIX = '/auth/login';

/**
 * Handles authentication and authorization errors returned by the backend.
 */
export const errorInterceptor: HttpInterceptorFn = (request, next) => {
    const authService = inject(AuthService);
    const router = inject(Router);

    return next(request).pipe(
        catchError((error: HttpErrorResponse) => {
            if (authService.isPreviewMode && !authService.getToken()) {
                return throwError(() => error);
            }

            if (error.status === UNAUTHORIZED_STATUS && !request.url.endsWith(LOGIN_URL_SUFFIX)) {
                const redirectTo = router.url;

                authService.logout();

                void router.navigate(['/auth/login'], {
                    queryParams: {
                        redirectTo,
                        reason: 'session-expired'
                    }
                });
            } else if (error.status === FORBIDDEN_STATUS) {
                void router.navigate(['/auth/access']);
            }

            return throwError(() => error);
        })
    );
};
