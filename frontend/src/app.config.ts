import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, LOCALE_ID } from '@angular/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideRouter, withComponentInputBinding, withEnabledBlockingInitialNavigation, withInMemoryScrolling } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { providePrimeNG } from 'primeng/config';
import { appRoutes } from './app.routes';
import { errorInterceptor } from './app/core/interceptors/error.interceptor';
import { jwtInterceptor } from './app/core/interceptors/jwt.interceptor';
import { MGS_PRESET } from './app/layout/theme/mgs-preset';
import { PRIMENG_SPANISH } from './app/layout/theme/primeng-spanish';

export const appConfig: ApplicationConfig = {
    providers: [
        provideRouter(appRoutes, withInMemoryScrolling({ anchorScrolling: 'enabled', scrollPositionRestoration: 'enabled' }), withEnabledBlockingInitialNavigation(), withComponentInputBinding()),
        provideHttpClient(withFetch(), withInterceptors([jwtInterceptor, errorInterceptor])),
        provideAnimationsAsync(),
        providePrimeNG({ theme: { preset: MGS_PRESET, options: { darkModeSelector: '.app-dark' } }, translation: PRIMENG_SPANISH }),
        { provide: LOCALE_ID, useValue: 'es' },
        MessageService,
        ConfirmationService
    ]
};
