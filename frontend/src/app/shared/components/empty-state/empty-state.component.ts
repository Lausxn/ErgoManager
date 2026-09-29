import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Message shown where a list has nothing to show yet, with room for an
 * action projected below the text.
 */
@Component({
    selector: 'app-empty-state',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: { class: 'mgs-empty' },
    template: `
        <span class="mgs-empty__icon" aria-hidden="true"><i [class]="icon()"></i></span>
        <strong class="mgs-empty__title">{{ title() }}</strong>
        @if (message()) {
            <p class="mgs-empty__message">{{ message() }}</p>
        }
        <ng-content />
    `
})
export class EmptyStateComponent {
    readonly icon = input('fa-regular fa-folder-open');
    readonly title = input.required<string>();
    readonly message = input('');
}
