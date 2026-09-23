import { Component, inject } from '@angular/core';
import { TooltipModule } from 'primeng/tooltip';
import { LayoutService, PAGE_SIZE_OPTIONS } from '../service/layout.service';

/**
 * Independent controls of the site preferences: a theme switch and a page
 * size stepper. Both choices are kept in the browser storage by the
 * LayoutService, and the same component is used on every page.
 */
@Component({
    selector: 'app-preferences',
    standalone: true,
    imports: [TooltipModule],
    template: `
        <div class="mgs-prefs__size" role="group" aria-label="Tamaño de página" [pTooltip]="'Tamaño de página: ' + layoutService.pageSizeLabel()" tooltipPosition="bottom">
            <button type="button" class="mgs-prefs__step" (click)="layoutService.stepPageSize(-1)" [disabled]="!layoutService.canDecreasePageSize()" aria-label="Reducir tamaño de página">
                <span class="mgs-prefs__letter mgs-prefs__letter--small">A</span><i class="pi pi-minus"></i>
            </button>
            <span class="mgs-prefs__levels" aria-live="polite">
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
            <button type="button" class="mgs-prefs__step" (click)="layoutService.stepPageSize(1)" [disabled]="!layoutService.canIncreasePageSize()" aria-label="Aumentar tamaño de página">
                <span class="mgs-prefs__letter">A</span><i class="pi pi-plus"></i>
            </button>
        </div>

        <button
            type="button"
            class="mgs-prefs__theme"
            (click)="layoutService.toggleTheme()"
            [pTooltip]="layoutService.isDarkTheme() ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'"
            tooltipPosition="bottom"
            [attr.aria-label]="layoutService.isDarkTheme() ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'"
        >
            <i class="pi" [class.pi-sun]="layoutService.isDarkTheme()" [class.pi-moon]="!layoutService.isDarkTheme()"></i>
        </button>
    `,
    host: { class: 'mgs-prefs' }
})
export class AppPreferences {
    protected readonly layoutService = inject(LayoutService);

    protected readonly pageSizeOptions = PAGE_SIZE_OPTIONS;
}
