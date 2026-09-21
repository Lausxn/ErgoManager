import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { AppFloatingConfigurator } from '../../../layout/component/app.floatingconfigurator';
import { BrandLogoComponent } from '../brand-logo/brand-logo.component';

/**
 * Full page message used by the access denied, error and not found pages.
 */
@Component({
    selector: 'app-status-page',
    standalone: true,
    imports: [RouterLink, ButtonModule, AppFloatingConfigurator, BrandLogoComponent],
    template: `
        <app-floating-configurator />
        <div class="mgs-public flex flex-col items-center justify-center px-4">
            <div class="mgs-card w-full max-w-xl flex flex-col items-center text-center gap-5 py-12">
                <app-brand-logo variant="symbol" [size]="64" />
                <span class="mgs-eyebrow">{{ code() }}</span>
                <h1 class="mgs-title">{{ title() }}</h1>
                <p class="mgs-subtitle">{{ message() }}</p>
                <p-button [label]="actionLabel()" icon="pi pi-arrow-left" routerLink="/" styleClass="mt-4" />
            </div>
        </div>
    `
})
export class StatusPageComponent {
    /** Short label shown above the title, such as the status code. */
    readonly code = input.required<string>();

    readonly title = input.required<string>();

    readonly message = input.required<string>();

    readonly actionLabel = input<string>('Volver al inicio');
}
