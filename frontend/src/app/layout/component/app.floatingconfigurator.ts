import { Component } from '@angular/core';
import { AppPreferences } from './app.preferences';

/**
 * Theme and page size controls for the pages shown outside the main layout
 * (login, public self evaluation, error pages).
 */
@Component({
    selector: 'app-floating-configurator',
    imports: [AppPreferences],
    template: `
        <div class="fixed top-4 right-4 z-50 mgs-prefs-floating">
            <app-preferences />
        </div>
    `
})
export class AppFloatingConfigurator {}
