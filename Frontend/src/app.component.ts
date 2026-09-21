import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ToastModule } from 'primeng/toast';

@Component({
    selector: 'app-root',
    standalone: true,
    imports: [RouterModule, ToastModule, ConfirmDialogModule],
    template: `<router-outlet></router-outlet>
        <p-toast position="top-right" />
        <p-confirmdialog [style]="{ width: '28rem' }" />`
})
export class AppComponent {}
