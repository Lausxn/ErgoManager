import { Injectable } from '@angular/core';
import Swal, { SweetAlertIcon } from 'sweetalert2';

const TOAST_DURATION_MS = 3500;

/** Class that places the toasts below the top bar (see .mgs-swal-container). */
const CONTAINER_CLASS = 'mgs-swal-container';

/**
 * Short notifications shown with SweetAlert2 in the top right corner. The look
 * follows the brand book: graphite for confirmations and wine, the accent
 * reserved for alerts, for errors (see .mgs-swal-toast in _mgs.scss).
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
        customClass: { container: CONTAINER_CLASS },
        didOpen: (popup) => {
            popup.addEventListener('mouseenter', Swal.stopTimer);
            popup.addEventListener('mouseleave', Swal.resumeTimer);
        }
    });

    /**
     * Confirms that an action finished well.
     *
     * @param title  short summary of what happened
     * @param detail optional context, such as the affected record
     */
    success(title: string, detail?: string): void {
        this.show('success', title, detail);
    }

    /**
     * Tells that an action failed and what to do next.
     *
     * @param title  short summary of the failure
     * @param detail optional hint to solve it
     */
    error(title: string, detail?: string): void {
        this.show('error', title, detail);
    }

    /**
     * Displays a non-blocking warning.
     *
     * @param title  short warning title
     * @param detail optional warning detail
     */
    warning(title: string, detail?: string): void {
        this.show('warning', title, detail);
    }

    /**
     * Gives neutral information, such as a process that keeps running.
     *
     * @param title  short summary
     * @param detail optional context
     */
    info(title: string, detail?: string): void {
        this.show('info', title, detail);
    }

    /**
     * Opens the toast. Texts go through title and text, never html, so
     * SweetAlert2 escapes them and data typed by users cannot inject markup.
     * The container class is repeated because SweetAlert2 replaces the whole
     * customClass of the mixin instead of merging it.
     */
    private show(icon: SweetAlertIcon, title: string, detail?: string): void {
        void this.toast.fire({ icon, title, text: detail, customClass: { container: CONTAINER_CLASS, popup: `mgs-swal-toast mgs-swal-toast--${icon}` } });
    }
}
