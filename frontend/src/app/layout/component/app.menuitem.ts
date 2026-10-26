import { Component, input } from '@angular/core';
import { IsActiveMatchOptions, RouterLink, RouterLinkActive } from '@angular/router';
import { MenuItem } from 'primeng/api';
import { RippleModule } from 'primeng/ripple';

/** Default highlight of a menu link: only on its exact screen. */
const EXACT_MATCH: IsActiveMatchOptions = { paths: 'exact', queryParams: 'ignored', matrixParams: 'ignored', fragment: 'ignored' };

/**
 * One entry of the side menu: a section title with its links, a link to a
 * screen of the application or a link that opens another page.
 */
@Component({
    // eslint-disable-next-line @angular-eslint/component-selector
    selector: '[app-menuitem]',
    imports: [RouterLink, RouterLinkActive, RippleModule],
    host: { '[class.layout-root-menuitem]': 'root()' },
    template: `
        @let entry = item();
        @if (entry.visible !== false) {
            @if (root()) {
                <div class="layout-menuitem-root-text">{{ entry.label }}</div>
            }
            @if (entry.routerLink && !entry.items) {
                <a [routerLink]="entry.routerLink" routerLinkActive="active-route" [routerLinkActiveOptions]="entry.routerLinkActiveOptions ?? exactMatch" tabindex="0" pRipple>
                    <i [class]="entry.icon + ' layout-menuitem-icon'"></i>
                    <span class="layout-menuitem-text">{{ entry.label }}</span>
                </a>
            } @else if (entry.url) {
                <a [attr.href]="entry.url" [attr.target]="entry.target" tabindex="0" pRipple>
                    <i [class]="entry.icon + ' layout-menuitem-icon'"></i>
                    <span class="layout-menuitem-text">{{ entry.label }}</span>
                </a>
            }
            @if (entry.items) {
                <ul>
                    @for (child of entry.items; track child.label) {
                        <li app-menuitem [item]="child"></li>
                    }
                </ul>
            }
        }
    `
})
export class AppMenuitemComponent {
    readonly item = input.required<MenuItem>();

    /** True for the section titles at the first level of the menu. */
    readonly root = input(false);

    protected readonly exactMatch = EXACT_MATCH;
}
