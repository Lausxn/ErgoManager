import { inject } from '@angular/core';
import { RedirectFunction } from '@angular/router';

import { AuthService } from '../services/auth.service';

/**
 * Sends the root url to the first page of the signed in user: the companies
 * for an administrator and the agenda for an ergonomist. Without a session it
 * goes straight to the login page.
 */
export const homeRedirect: RedirectFunction = () => {
    const authService = inject(AuthService);
    return authService.isAuthenticated() ? authService.getHomeUrl() : '/auth/login';
};
