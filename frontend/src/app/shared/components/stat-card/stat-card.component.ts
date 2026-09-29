import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { SkeletonModule } from 'primeng/skeleton';

/**
 * Key figure of a page ("Datos clave" of the brand book, page 15): short
 * uppercase label, large bold value and an optional note. The accent variant
 * draws the wine rule, reserved for the figure that needs attention.
 */
@Component({
    selector: 'app-stat-card',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [SkeletonModule],
    host: { class: 'mgs-stat', '[class.mgs-stat--accent]': 'accent()', '[class.mgs-stat--dark]': 'dark()' },
    template: `
        <div class="mgs-stat__head">
            <span class="mgs-stat__label">{{ label() }}</span>
            @if (icon()) {
                <i [class]="icon() + ' mgs-stat__icon'" aria-hidden="true"></i>
            }
        </div>
        @if (loading()) {
            <p-skeleton width="4rem" height="2.5rem" styleClass="mt-3" />
        } @else {
            <span class="mgs-stat__value">{{ value() }}</span>
        }
        @if (note()) {
            <span class="mgs-stat__note">{{ note() }}</span>
        }
    `
})
export class StatCardComponent {
    readonly label = input.required<string>();
    readonly value = input<number | string | null>(null);
    readonly note = input('');
    readonly icon = input('');
    readonly loading = input(false);

    /** Wine rule on top, for the figure that deserves attention. */
    readonly accent = input(false);

    /** Black impact card, like the "Autoridad" block of the brand book. */
    readonly dark = input(false);
}
