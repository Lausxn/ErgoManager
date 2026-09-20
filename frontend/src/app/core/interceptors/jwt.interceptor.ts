import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';

import { AuthService } from '../services/auth.service';

const AUTHORIZATION_HEADER = 'Authorization';

/**
 * Attaches the stored JWT to every outgoing request, so the backend can
 * authenticate it.
 */
export const jwtInterceptor: HttpInterceptorFn = (request, next) => {
  const token = inject(AuthService).getToken();

  if (token === null) {
    return next(request);
  }

  return next(
    request.clone({ setHeaders: { [AUTHORIZATION_HEADER]: `Bearer ${token}` } }),
  );
};
