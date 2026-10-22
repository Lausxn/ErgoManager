import { inject } from '@angular/core';
import { RedirectFunction } from '@angular/router';

import { AuthService } from '../services/auth.service';

/**
 * Sends the root url to the dashboard of the signed in user. Without a session
 * it goes straight to the login page.
 */
export const homeRedirect: RedirectFunction = () => {
    const authService = inject(AuthService);
    return authService.isAuthenticated() ? authService.getHomeUrl() : '/auth/login';
};
