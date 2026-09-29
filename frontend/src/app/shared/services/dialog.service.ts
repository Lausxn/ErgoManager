import { Injectable } from '@angular/core';
import Swal from 'sweetalert2';

/** Texts and tone of a confirmation dialog. */
export interface ConfirmOptions {
    /** Question in a few words, such as "Desactivar empresa". */
    title: string;
    /** Consequence of the action, in plain text. */
    message: string;
    /** Label of the button that runs the action. */
    confirmLabel: string;
    /** Label of the button that closes the dialog, "Cancelar" by default. */
    cancelLabel?: string;
    /** Destructive actions paint the confirm button in wine, the alert accent. */
    destructive?: boolean;
    /** PrimeIcons class shown above the title. */
    icon?: string;
}

/**
 * Modal confirmations shown with SweetAlert2, the same library as the toasts,
 * dressed with the brand book tokens (see .mgs-swal-dialog in _mgs.scss).
 */
@Injectable({ providedIn: 'root' })
export class DialogService {
    /**
     * Asks the user to confirm an action.
     *
     * @param options texts and tone of the dialog
     * @returns true when the user confirmed
     */
    async confirm(options: ConfirmOptions): Promise<boolean> {
        const icon = options.icon ?? (options.destructive ? 'fa-solid fa-triangle-exclamation' : 'fa-solid fa-circle-question');
        const result = await Swal.fire({
            title: options.title,
            text: options.message,
            iconHtml: `<i class="${icon}" aria-hidden="true"></i>`,
            showCancelButton: true,
            confirmButtonText: options.confirmLabel,
            cancelButtonText: options.cancelLabel ?? 'Cancelar',
            reverseButtons: true,
            focusCancel: options.destructive ?? false,
            buttonsStyling: false,
            showClass: { popup: 'mgs-swal-dialog--in' },
            hideClass: { popup: 'mgs-swal-dialog--out' },
            customClass: {
                container: 'mgs-swal-dialog-container',
                popup: `mgs-swal-dialog${options.destructive ? ' mgs-swal-dialog--destructive' : ''}`,
                icon: 'mgs-swal-dialog__icon',
                title: 'mgs-swal-dialog__title',
                htmlContainer: 'mgs-swal-dialog__text',
                actions: 'mgs-swal-dialog__actions',
                confirmButton: 'mgs-swal-dialog__confirm',
                cancelButton: 'mgs-swal-dialog__cancel'
            }
        });
        return result.isConfirmed;
    }
}
