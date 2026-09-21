import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from '../services/auth.service';

/**
 * Blocks a route when nobody is signed in and sends the visitor to the login
 * page, keeping the requested url so it can be reopened afterwards.
 */
export const authGuard: CanActivateFn = (_route, state) => {
    const authService = inject(AuthService);
    const router = inject(Router);

    if (authService.isAuthenticated()) {
        return true;
    }

    authService.logout();
    return router.createUrlTree(['/auth/login'], { queryParams: { redirectTo: state.url } });
};
