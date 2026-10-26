import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import { environment } from '../../../environments/environment';
import { SESSION_MESSAGE_STATE_KEY } from '../interceptors/error.interceptor';
import { AuthService, LAST_ACTIVITY_STORAGE_KEY } from './auth.service';
import { INACTIVITY_MESSAGE, InactivityService } from './inactivity.service';

describe('InactivityService', () => {
    let service: InactivityService;
    let authService: jasmine.SpyObj<AuthService>;
    let router: jasmine.SpyObj<Router>;

    beforeEach(() => {
        authService = jasmine.createSpyObj<AuthService>('AuthService', ['logout']);
        router = jasmine.createSpyObj<Router>('Router', ['navigate'], { url: '/users' });
        router.navigate.and.resolveTo(true);
        TestBed.configureTestingModule({
            providers: [
                { provide: AuthService, useValue: authService },
                { provide: Router, useValue: router }
            ]
        });
        service = TestBed.inject(InactivityService);
    });

    afterEach(() => {
        service.stop();
        localStorage.removeItem(LAST_ACTIVITY_STORAGE_KEY);
    });

    it('mantiene la sesión mientras no se supera el tiempo de inactividad', () => {
        localStorage.setItem(LAST_ACTIVITY_STORAGE_KEY, String(Date.now() - environment.inactivityTimeoutMs + 60000));
        service.checkInactivity();
        expect(authService.logout).not.toHaveBeenCalled();
        expect(router.navigate).not.toHaveBeenCalled();
    });

    it('cierra la sesión y explica el motivo al superar el tiempo de inactividad', () => {
        localStorage.setItem(LAST_ACTIVITY_STORAGE_KEY, String(Date.now() - environment.inactivityTimeoutMs - 1000));
        service.checkInactivity();
        expect(authService.logout).toHaveBeenCalled();
        expect(router.navigate).toHaveBeenCalledWith(['/auth/login'], { queryParams: { redirectTo: '/users' }, state: { [SESSION_MESSAGE_STATE_KEY]: INACTIVITY_MESSAGE } });
    });

    it('registra la actividad al iniciar si no había ninguna', () => {
        service.start();
        const recorded = Number(localStorage.getItem(LAST_ACTIVITY_STORAGE_KEY));
        expect(Date.now() - recorded).toBeLessThan(1000);
        expect(authService.logout).not.toHaveBeenCalled();
    });

    it('actualiza la última actividad cuando el usuario interactúa', () => {
        localStorage.setItem(LAST_ACTIVITY_STORAGE_KEY, String(Date.now() - 60000));
        service.start();
        document.dispatchEvent(new MouseEvent('click'));
        const recorded = Number(localStorage.getItem(LAST_ACTIVITY_STORAGE_KEY));
        expect(Date.now() - recorded).toBeLessThan(1000);
    });
});
