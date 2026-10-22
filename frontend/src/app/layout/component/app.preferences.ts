import { Component, ElementRef, computed, inject, signal } from '@angular/core';
import { LayoutService, PAGE_SIZE_OPTIONS } from '../service/layout.service';

/** Base font size of the "Normal" page size, shown as 100 %. */
const NORMAL_FONT_SIZE = PAGE_SIZE_OPTIONS.find((option) => option.value === 'normal')!.fontSize;

/**
 * Display preferences menu: a button that opens a panel with the text size
 * slider and the dark mode switch. Both choices are kept in the browser
 * storage by the LayoutService, and the same component is used on every page.
 */
@Component({
    selector: 'app-preferences',
    standalone: true,
    template: `
        <button type="button" class="mgs-prefs__trigger" [class.mgs-prefs__trigger--open]="open()" (click)="toggle()" aria-haspopup="dialog" [attr.aria-expanded]="open()" aria-controls="mgs-prefs-panel" aria-label="Opciones de visualización">
            <i class="pi pi-sliders-h"></i>
            <i class="pi pi-chevron-down mgs-prefs__chevron"></i>
        </button>

        @if (open()) {
            <div id="mgs-prefs-panel" class="mgs-prefs__panel" role="dialog" aria-labelledby="mgs-prefs-title">
                <header class="mgs-prefs__header">
                    <span class="mgs-prefs__rule" aria-hidden="true"></span>
                    <h2 id="mgs-prefs-title" class="mgs-prefs__title">Visualización</h2>
                    <p class="mgs-prefs__subtitle">Ajuste la interfaz a su gusto.</p>
                </header>

                <section class="mgs-prefs__section" aria-labelledby="mgs-prefs-size-label">
                    <div class="mgs-prefs__section-head">
                        <span id="mgs-prefs-size-label" class="mgs-prefs__label">Tamaño de texto</span>
                        <span class="mgs-prefs__percent" aria-live="polite">{{ percent() }} %</span>
                    </div>
                    <div class="mgs-prefs__slider">
                        <span class="mgs-prefs__letter mgs-prefs__letter--small" aria-hidden="true">A</span>
                        <input
                            id="mgs-prefs-size"
                            type="range"
                            class="mgs-prefs__range"
                            min="0"
                            [max]="pageSizeOptions.length - 1"
                            step="1"
                            [value]="layoutService.pageSizeIndex()"
                            [style.--mgs-prefs-fill]="fill()"
                            (input)="selectSize($event)"
                            aria-labelledby="mgs-prefs-size-label"
                            [attr.aria-valuetext]="layoutService.pageSizeLabel() + ', ' + percent() + ' %'"
                        />
                        <span class="mgs-prefs__letter mgs-prefs__letter--large" aria-hidden="true">A</span>
                        <div class="mgs-prefs__ticks" aria-hidden="true">
                            @for (option of pageSizeOptions; track option.value; let index = $index) {
                                <span [class.mgs-prefs__tick--active]="index === layoutService.pageSizeIndex()">{{ percentOf(option.fontSize) }} %</span>
                            }
                        </div>
                    </div>
                    <button type="button" class="mgs-prefs__reset" (click)="layoutService.setPageSize('normal')" [disabled]="layoutService.pageSize() === 'normal'">Restablecer tamaño</button>
                </section>

                <section class="mgs-prefs__section mgs-prefs__mode">
                    <span class="mgs-prefs__mode-icon" aria-hidden="true"><i class="pi" [class.pi-moon]="layoutService.isDarkTheme()" [class.pi-sun]="!layoutService.isDarkTheme()"></i></span>
                    <span class="mgs-prefs__mode-text">
                        <span id="mgs-prefs-theme-label" class="mgs-prefs__mode-title">Modo oscuro</span>
                        <span class="mgs-prefs__mode-state">{{ layoutService.isDarkTheme() ? 'Activado' : 'Desactivado' }}</span>
                    </span>
                    <button type="button" role="switch" class="mgs-prefs__switch" [attr.aria-checked]="layoutService.isDarkTheme()" aria-labelledby="mgs-prefs-theme-label" (click)="layoutService.toggleTheme()">
                        <span class="mgs-prefs__knob"></span>
                    </button>
                </section>
            </div>
        }
    `,
    host: {
        class: 'mgs-prefs',
        '(document:click)': 'closeOnOutsideClick($event)',
        '(document:keydown.escape)': 'close()'
    }
})
export class AppPreferences {
    protected readonly layoutService = inject(LayoutService);
    private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
    protected readonly pageSizeOptions = PAGE_SIZE_OPTIONS;
    protected readonly open = signal(false);

    /** Current page size as a percentage of the normal size. */
    protected readonly percent = computed(() => this.percentOf(PAGE_SIZE_OPTIONS[this.layoutService.pageSizeIndex()].fontSize));

    /** Part of the slider track painted up to the thumb. */
    protected readonly fill = computed(() => `${(this.layoutService.pageSizeIndex() / (PAGE_SIZE_OPTIONS.length - 1)) * 100}%`);

    /**
     * Converts a font size into a percentage of the normal size.
     *
     * @param fontSize base font size in pixels
     * @returns rounded percentage
     */
    protected percentOf(fontSize: number): number {
        return Math.round((fontSize / NORMAL_FONT_SIZE) * 100);
    }

    /**
     * Applies the size picked with the slider.
     *
     * @param event input event of the range element
     */
    protected selectSize(event: Event): void {
        const index = Number((event.target as HTMLInputElement).value);
        this.layoutService.setPageSize(PAGE_SIZE_OPTIONS[index].value);
    }

    /** Opens or closes the panel. */
    protected toggle(): void {
        this.open.update((open) => !open);
    }

    /** Closes the panel. */
    protected close(): void {
        this.open.set(false);
    }

    /**
     * Closes the panel when the user clicks anywhere outside the menu.
     *
     * @param event click received by the document
     */
    protected closeOnOutsideClick(event: MouseEvent): void {
        if (this.open() && !this.host.nativeElement.contains(event.target as Node)) {
            this.close();
        }
    }
}
