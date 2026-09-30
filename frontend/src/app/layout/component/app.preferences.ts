import { Component, ElementRef, computed, inject, signal } from '@angular/core';
import { LayoutService, PAGE_SIZE_OPTIONS } from '../service/layout.service';

/** Base font size of the "Normal" page size, shown as 100 %. */
const NORMAL_FONT_SIZE = PAGE_SIZE_OPTIONS.find((option) => option.value === 'normal')!.fontSize;

/**
 * Display preferences menu: a button that opens a panel with the text size
 * stepper and the dark mode switch. Both choices are kept in the browser
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
                    <div class="mgs-prefs__size" role="group" aria-labelledby="mgs-prefs-size-label">
                        <button type="button" class="mgs-prefs__step" (click)="layoutService.stepPageSize(-1)" [disabled]="!layoutService.canDecreasePageSize()" aria-label="Reducir tamaño de texto">A–</button>
                        <span class="mgs-prefs__levels">
                            @for (option of pageSizeOptions; track option.value; let index = $index) {
                                <button
                                    type="button"
                                    class="mgs-prefs__level"
                                    [class.mgs-prefs__level--active]="index <= layoutService.pageSizeIndex()"
                                    (click)="layoutService.setPageSize(option.value)"
                                    [attr.aria-label]="option.label"
                                    [attr.aria-pressed]="option.value === layoutService.pageSize()"
                                ></button>
                            }
                        </span>
                        <button type="button" class="mgs-prefs__step" (click)="layoutService.stepPageSize(1)" [disabled]="!layoutService.canIncreasePageSize()" aria-label="Aumentar tamaño de texto">A+</button>
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
    protected readonly percent = computed(() => Math.round((PAGE_SIZE_OPTIONS[this.layoutService.pageSizeIndex()].fontSize / NORMAL_FONT_SIZE) * 100));

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
