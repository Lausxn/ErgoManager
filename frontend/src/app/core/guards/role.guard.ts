import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { Role } from '../../shared/models/role.model';
import { AuthService } from '../services/auth.service';

/**
 * Builds a guard that only lets through the users holding one of the roles.
 *
 * @param allowedRoles roles that can reach the route
 * @returns guard ready to be used in the canActivate array of a route
 */
export function roleGuard(allowedRoles: readonly Role[]): CanActivateFn {
  return () => {
    const authService = inject(AuthService);
    const router = inject(Router);

    if (authService.hasAnyRole(allowedRoles)) {
      return true;
    }

    return router.createUrlTree(['/login']);
  };
}
