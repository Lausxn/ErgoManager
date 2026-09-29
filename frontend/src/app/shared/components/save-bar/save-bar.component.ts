import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ButtonModule } from 'primeng/button';

import { UnsavedChangesState } from '../../forms/unsaved-changes';

/**
 * Bar of unsaved changes, like the one of Discord: it slides in while the form
 * has changes, offers to discard or save them, and shakes in wine when the
 * user tries to leave without deciding. Place it inside the form element, so
 * its save button submits the form.
 */
@Component({
    selector: 'app-save-bar',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [ButtonModule],
    // No box of its own, so the bar sticks to the bottom of the whole form.
    host: { style: 'display: contents' },
    template: `
        @if (tracker().hasChanges() || saving()) {
            <div class="mgs-save-bar" [class.mgs-save-bar--alert]="tracker().isAlerting()" role="region" aria-label="Cambios sin guardar" aria-live="polite">
                <span class="mgs-save-bar__text">
                    <i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>
                    {{ message() }}
                </span>
                <div class="mgs-save-bar__actions">
                    <p-button type="button" [label]="discardLabel()" [text]="true" [disabled]="saving()" (onClick)="discard()" />
                    <p-button type="submit" [label]="submitLabel()" [icon]="submitIcon()" [loading]="saving()" />
                </div>
            </div>
        }
    `
})
export class SaveBarComponent {
    /** Tracker of the form the bar belongs to. */
    readonly tracker = input.required<UnsavedChangesState>();

    /** True while the request is running: the bar stays visible with a spinner. */
    readonly saving = input(false);

    readonly message = input('Cuidado, tiene cambios sin guardar.');

    readonly discardLabel = input('Descartar');

    readonly submitLabel = input('Guardar cambios');

    readonly submitIcon = input('pi pi-check');

    /** Emitted after the changes were discarded, to clear messages of the page. */
    readonly discarded = output<void>();

    protected discard(): void {
        this.tracker().discard();
        this.discarded.emit();
    }
}
