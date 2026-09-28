import { Component, computed, inject, input } from '@angular/core';
import { LayoutService } from '../../../layout/service/layout.service';

/** Versions of the logo defined by the brand book (pages 6 and 7). */
export type BrandLogoVariant = 'full' | 'symbol';

/** Tone of the logo: automatic follows the theme, the others force a version. */
export type BrandLogoTone = 'auto' | 'color' | 'black' | 'white';

/**
 * MGS logo taken from the master files. It never rebuilds the logo with text:
 * it only picks the right version for the background.
 *
 * - Full color on light backgrounds, white on dark backgrounds (page 10).
 * - Minimum width of 200 px for the full logo and 48 px for the symbol (page 9).
 * - Clear space of 25 % of the symbol height on the four sides (page 8).
 */
@Component({
    selector: 'app-brand-logo',
    standalone: true,
    template: `<img [src]="source()" [alt]="altText" [style.width.px]="width()" class="block max-w-none select-none" draggable="false" />`,
    host: { class: 'inline-flex shrink-0', '[style.padding.px]': 'clearSpace()' }
})
export class BrandLogoComponent {
    private readonly layoutService = inject(LayoutService);

    /** Full signature or symbol only. */
    readonly variant = input<BrandLogoVariant>('full');

    /** Version of the logo, automatic by default. */
    readonly tone = input<BrandLogoTone>('auto');

    /** Width in pixels; the brand book minimums are always enforced. */
    readonly size = input<number | undefined>(undefined);

    protected readonly altText = 'Madrigal Group Solutions';

    protected readonly width = computed(() => {
        const minimum = this.variant() === 'full' ? FULL_LOGO_MIN_WIDTH : SYMBOL_MIN_WIDTH;
        return Math.max(this.size() ?? minimum, minimum);
    });

    protected readonly clearSpace = computed(() => {
        const symbolHeight = this.variant() === 'full' ? this.width() * FULL_LOGO_HEIGHT_RATIO : this.width();
        return Math.round(symbolHeight * CLEAR_SPACE_RATIO);
    });

    protected readonly source = computed(() => {
        const tone = this.tone() === 'auto' ? (this.layoutService.isDarkTheme() ? 'white' : 'color') : this.tone();
        const name = this.variant() === 'full' ? 'logo' : 'symbol';
        return `brand/mgs-${name}-${tone}.png`;
    });
}

const FULL_LOGO_MIN_WIDTH = 200;

const SYMBOL_MIN_WIDTH = 48;

/** Height of the full logo compared with its width, measured on the master file. */
const FULL_LOGO_HEIGHT_RATIO = 290 / 1527;

const CLEAR_SPACE_RATIO = 0.25;
