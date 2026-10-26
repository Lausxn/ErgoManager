import { Component } from '@angular/core';

import { AppMenuComponent } from './app.menu';

/** Panel at the left of the layout that holds the side menu. */
@Component({
    selector: 'app-sidebar',
    imports: [AppMenuComponent],
    template: `<div class="layout-sidebar">
        <app-menu />
    </div>`
})
export class AppSidebarComponent {}
