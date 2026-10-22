import { Component, input, output } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';

/**
 * Shows the temporary-password reminder after a successful sign in.
 * The parent decides when to display it and what to do when the user
 * requests the password update.
 */
@Component({
    selector: 'app-password-update-popup',
    standalone: true,
    imports: [ButtonModule, DialogModule],
    templateUrl: './password-update-popup.component.html',
    styleUrl: './password-update-popup.component.css'
})
export class PasswordUpdatePopupComponent {
    /** Controls whether the pop-up is visible. */
    readonly visible = input(false);

    /** Notifies the parent that the pop-up must be closed. */
    readonly closed = output<void>();

    /** Notifies the parent that the user chose to update the password. */
    readonly updateRequested = output<void>();

    /**
     * Closes the reminder without starting the password-change flow.
     */
    protected closePopup(): void {
        this.closed.emit();
    }

    /**
     * Starts the password-change flow in the parent component.
     */
    protected requestPasswordUpdate(): void {
        this.updateRequested.emit();
    }

    /**
     * Keeps the parent synchronized when PrimeNG closes the dialog with Escape.
     *
     * @param isVisible current visibility emitted by the dialog
     */
    protected handleVisibilityChange(isVisible: boolean): void {
        if (!isVisible) {
            this.closePopup();
        }
    }
}
