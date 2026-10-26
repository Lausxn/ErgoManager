import { animate, style, transition, trigger } from '@angular/animations';
import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, input, output, signal, untracked } from '@angular/core';
import { ButtonModule } from 'primeng/button';

/** Time the reminder stays on screen while the user does not interact with it. */
export const PASSWORD_REMINDER_AUTO_HIDE_MS = 15000;

/** Length of the entrance and exit, zero when the user asks for reduced motion. */
const MOTION_MS = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 0 : 220;

/**
 * Shows the temporary-password reminder after a successful sign in as a
 * compact card at the top of the screen. It does not block the page and hides
 * itself after a while; hovering or focusing it keeps it open.
 * The parent decides when to display it and what to do when the user
 * requests the password update.
 */
@Component({
    selector: 'app-password-update-popup',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [ButtonModule],
    templateUrl: './password-update-popup.component.html',
    styleUrl: './password-update-popup.component.css',
    animations: [
        trigger('reminder', [
            transition(':enter', [style({ opacity: 0, transform: 'translateY(-0.75rem)' }), animate('{{ duration }}ms cubic-bezier(0.2, 0.7, 0.2, 1)', style({ opacity: 1, transform: 'none' }))], { params: { duration: MOTION_MS } }),
            transition(':leave', [animate('{{ duration }}ms ease-in', style({ opacity: 0, transform: 'translateY(-0.5rem)' }))], { params: { duration: MOTION_MS } })
        ])
    ]
})
export class PasswordUpdatePopupComponent {
    /** Controls whether the pop-up is visible. */
    readonly visible = input(false);

    /** Notifies the parent that the pop-up must be closed. */
    readonly closed = output<void>();

    /** Notifies the parent that the user chose to update the password. */
    readonly updateRequested = output<void>();

    protected readonly autoHideMs = PASSWORD_REMINDER_AUTO_HIDE_MS;
    protected readonly motionMs = MOTION_MS;

    /** Whether the countdown is stopped because the pointer or the focus is on the card. */
    protected readonly isPaused = signal(false);

    private hideTimer?: ReturnType<typeof setTimeout>;
    private remainingMs = PASSWORD_REMINDER_AUTO_HIDE_MS;
    private countdownStartedAt = 0;

    constructor() {
        effect(() => {
            const isVisible = this.visible();
            untracked(() => (isVisible ? this.startCountdown() : this.stopCountdown()));
        });
        inject(DestroyRef).onDestroy(() => this.stopCountdown());
    }

    /**
     * Closes the reminder without starting the password-change flow.
     */
    protected closePopup(): void {
        this.stopCountdown();
        this.closed.emit();
    }

    /**
     * Starts the password-change flow in the parent component.
     */
    protected requestPasswordUpdate(): void {
        this.stopCountdown();
        this.updateRequested.emit();
    }

    /** Keeps the reminder open while the user is reading or using it. */
    protected pause(): void {
        if (this.isPaused() || this.hideTimer === undefined) {
            return;
        }
        clearTimeout(this.hideTimer);
        this.hideTimer = undefined;
        this.remainingMs -= Date.now() - this.countdownStartedAt;
        this.isPaused.set(true);
    }

    /** Continues the countdown from where it stopped. */
    protected resume(): void {
        if (!this.isPaused()) {
            return;
        }
        this.isPaused.set(false);
        this.schedule();
    }

    /**
     * Continues the countdown only when the focus leaves the card.
     *
     * @param event focus event of the card
     */
    protected onFocusOut(event: FocusEvent): void {
        const card = event.currentTarget as HTMLElement;
        if (!card.contains(event.relatedTarget as Node | null)) {
            this.resume();
        }
    }

    private startCountdown(): void {
        this.stopCountdown();
        this.remainingMs = PASSWORD_REMINDER_AUTO_HIDE_MS;
        this.schedule();
    }

    private schedule(): void {
        this.countdownStartedAt = Date.now();
        this.hideTimer = setTimeout(() => this.closePopup(), Math.max(this.remainingMs, 0));
    }

    private stopCountdown(): void {
        clearTimeout(this.hideTimer);
        this.hideTimer = undefined;
        this.isPaused.set(false);
    }
}
