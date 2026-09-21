import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

import { AuthService } from '../services/auth.service';

const UNAUTHORIZED_STATUS = 401;

/**
 * Signs the user out when the backend rejects the token, and lets every other
 * failure reach the component that made the call.
 */
export const errorInterceptor: HttpInterceptorFn = (request, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return next(request).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === UNAUTHORIZED_STATUS) {
        authService.logout();
        void router.navigate(['/login']);
      }
      return throwError(() => error);
    }),
  );
};
