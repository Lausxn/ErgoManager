import { Injectable } from '@angular/core';
import Swal, { SweetAlertIcon } from 'sweetalert2';

const TOAST_DURATION_MS = 3500;

/**
 * Shared SweetAlert2 notifications for ErgoManager.
 * The visual treatment follows the MGS palette through global CSS variables.
 */
@Injectable({ providedIn: 'root' })
export class ToastService {
    private readonly toast = Swal.mixin({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        showCloseButton: true,
        closeButtonAriaLabel: 'Cerrar notificación',
        timer: TOAST_DURATION_MS,
        timerProgressBar: true,
        customClass: { container: 'mgs-swal-container' },
        didOpen: (popup) => {
            popup.addEventListener('mouseenter', Swal.stopTimer);
            popup.addEventListener('mouseleave', Swal.resumeTimer);
        }
    });

    /**
     * Confirms that an operation completed successfully.
     *
     * @param title short summary of the result
     * @param detail optional contextual information
     */
    success(title: string, detail?: string): void {
        this.show('success', title, detail);
    }

    /**
     * Reports an operation that could not be completed.
     *
     * @param title short summary of the problem
     * @param detail optional recovery hint
     */
    error(title: string, detail?: string): void {
        this.show('error', title, detail);
    }

    /**
     * Displays a non-blocking warning.
     *
     * @param title short warning title
     * @param detail optional warning detail
     */
    warning(title: string, detail?: string): void {
        this.show('warning', title, detail);
    }

    private show(icon: SweetAlertIcon, title: string, detail?: string): void {
        void this.toast.fire({
            icon,
            title,
            text: detail,
            customClass: { popup: `mgs-swal-toast mgs-swal-toast--${icon}` }
        });
    }
}
