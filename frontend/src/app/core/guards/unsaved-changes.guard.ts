import { inject } from '@angular/core';
import { CanDeactivateFn } from '@angular/router';

import { AuthService } from '../services/auth.service';

/** Page that can hold changes the user has not saved yet. */
export interface HasUnsavedChanges {
    canLeave(): boolean;
}

/**
 * Protects unsaved changes during normal navigation, but never blocks
 * authentication redirects caused by logout, expiration or denied access.
 */
export const unsavedChangesGuard: CanDeactivateFn<HasUnsavedChanges> = (component, _currentRoute, _currentState, nextState) => {
    const authService = inject(AuthService);

    if (!authService.isAuthenticated()) {
        return true;
    }

    if (nextState.url.startsWith('/auth/access')) {
        return true;
    }

    return component.canLeave();
};
