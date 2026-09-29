import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';

/**
 * Root of ErgoManager. Notifications and confirmations are shown with
 * SweetAlert2 (ToastService and DialogService), so no host element is needed.
 */
@Component({
    selector: 'app-root',
    standalone: true,
    imports: [RouterModule],
    template: `<router-outlet></router-outlet>`
})
export class AppComponent {}
