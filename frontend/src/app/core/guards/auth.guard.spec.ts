import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, RedirectCommand, Router, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';

import { SESSION_MESSAGE_STATE_KEY } from '../interceptors/error.interceptor';
import { AuthService } from '../services/auth.service';
import { SESSION_EXPIRED_MESSAGE, authGuard } from './auth.guard';

describe('authGuard', () => {
    let authService: jasmine.SpyObj<AuthService>;

    /** Runs the guard for the given url. */
    function run(url: string): ReturnType<typeof authGuard> {
        return TestBed.runInInjectionContext(() => authGuard({} as ActivatedRouteSnapshot, { url } as RouterStateSnapshot));
    }

    beforeEach(() => {
        authService = jasmine.createSpyObj<AuthService>('AuthService', ['isAuthenticated', 'hasExpiredSession', 'logout']);
        TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: AuthService, useValue: authService }] });
    });

    it('deja pasar al usuario con sesión válida', () => {
        authService.isAuthenticated.and.returnValue(true);
        expect(run('/users')).toBeTrue();
        expect(authService.logout).not.toHaveBeenCalled();
    });

    it('envía al login sin mensaje a quien nunca inició sesión', () => {
        authService.isAuthenticated.and.returnValue(false);
        authService.hasExpiredSession.and.returnValue(false);
        const result = run('/users') as UrlTree;
        expect(result).toBeInstanceOf(UrlTree);
        expect(TestBed.inject(Router).serializeUrl(result)).toBe('/auth/login?redirectTo=%2Fusers');
    });

    it('envía al login con el mensaje de sesión expirada cuando el token venció', () => {
        authService.isAuthenticated.and.returnValue(false);
        authService.hasExpiredSession.and.returnValue(true);
        const result = run('/users') as RedirectCommand;
        expect(result).toBeInstanceOf(RedirectCommand);
        expect(TestBed.inject(Router).serializeUrl(result.redirectTo as UrlTree)).toBe('/auth/login?redirectTo=%2Fusers');
        expect(result.navigationBehaviorOptions?.state).toEqual({ [SESSION_MESSAGE_STATE_KEY]: SESSION_EXPIRED_MESSAGE });
        expect(authService.logout).toHaveBeenCalled();
    });
});
