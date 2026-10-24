import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { PageHeaderComponent } from '../page-header/page-header.component';

/** Screen offered by an option hub. */
export interface HubOption {
    title: string;
    description: string;
    icon: string;
    route: string;
}

/** Line shown under the title when the route does not give one. */
const DEFAULT_LEAD = 'Elija qué desea gestionar.';

/**
 * Entry of a section with a few screens: square option cards in the middle of
 * the page. The route gives the heading, the lead and the options as data.
 */
@Component({
    selector: 'app-option-hub',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [RouterLink, PageHeaderComponent],
    host: { class: 'mgs-option-stage' },
    template: `
        <app-page-header [title]="heading()" [subtitle]="lead()" />

        <ul class="mgs-option-grid mgs-option-grid--centered" [attr.aria-label]="'Opciones de ' + heading().toLowerCase()">
            @for (option of options(); track option.route) {
                <li>
                    <a class="mgs-option mgs-option--tile" [routerLink]="option.route">
                        <span class="mgs-option__top">
                            <span class="mgs-option__icon" aria-hidden="true"><i [class]="option.icon"></i></span>
                        </span>
                        <span class="mgs-option__title">{{ option.title }}</span>
                        <span class="mgs-option__description">{{ option.description }}</span>
                        <span class="mgs-option__arrow" aria-hidden="true"><i class="fa-solid fa-arrow-right"></i></span>
                    </a>
                </li>
            }
        </ul>
    `
})
export class OptionHubComponent {
    /** Title of the section. */
    readonly heading = input.required<string>();

    /** Line under the title; the router binds undefined when the route data has none. */
    readonly lead = input(DEFAULT_LEAD, { transform: (lead: string | undefined) => lead ?? DEFAULT_LEAD });

    /** Screens of the section. */
    readonly options = input.required<readonly HubOption[]>();
}
