import { Injectable } from '@angular/core';
import Swal, { SweetAlertIcon } from 'sweetalert2';

const TOAST_DURATION_MS = 3500;

/**
 * Short notifications shown with SweetAlert2 in the top right corner.
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
        customClass: {
            container: 'mgs-swal-container'
        },
        didOpen: (popup) => {
            popup.addEventListener('mouseenter', Swal.stopTimer);
            popup.addEventListener('mouseleave', Swal.resumeTimer);
        }
    });

    success(title: string, detail?: string): void {
        this.show('success', title, detail);
    }

    error(title: string, detail?: string): void {
        this.show('error', title, detail);
    }

    private show(icon: SweetAlertIcon, title: string, detail?: string): void {
        void this.toast.fire({
            icon,
            title,
            text: detail,
            customClass: {
                container: 'mgs-swal-container',
                popup: `mgs-swal-toast mgs-swal-toast--${icon}`
            }
        });
    }
}
