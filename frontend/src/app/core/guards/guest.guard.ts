import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from '../services/auth.service';

/**
 * Keeps a signed in user away from the login page, sending them to their
 * home page instead.
 */
export const guestGuard: CanActivateFn = () => {
    const authService = inject(AuthService);
    const router = inject(Router);

    // In preview mode everyone counts as signed in, but the login page must stay reachable.
    if (authService.isPreviewMode || !authService.isAuthenticated()) {
        return true;
    }

    return router.parseUrl(authService.getHomeUrl());
};
