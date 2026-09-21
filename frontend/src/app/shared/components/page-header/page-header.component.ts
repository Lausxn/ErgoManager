import { Component, input } from '@angular/core';

/**
 * Header of every page, following the base grid of the brand book (page 17):
 * a wine accent bar, a short uppercase label, a direct title and a gray
 * subtitle. Actions projected into the component are placed on the right.
 */
@Component({
    selector: 'app-page-header',
    standalone: true,
    template: `
        <header class="mgs-page-header">
            <div class="mgs-page-header__text">
                @if (eyebrow()) {
                    <span class="mgs-eyebrow">{{ eyebrow() }}</span>
                }
                <h1 class="mgs-title">{{ title() }}</h1>
                @if (subtitle()) {
                    <p class="mgs-subtitle">{{ subtitle() }}</p>
                }
            </div>
            <div class="mgs-page-header__actions">
                <ng-content />
            </div>
        </header>
    `
})
export class PageHeaderComponent {
    /** Short label shown above the title. */
    readonly eyebrow = input<string>('');

    /** Title of the page. */
    readonly title = input.required<string>();

    /** Context of the page, shown under the title. */
    readonly subtitle = input<string>('');
}
