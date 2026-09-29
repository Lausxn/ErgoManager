import { DestroyRef, Signal, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl } from '@angular/forms';
import { fromEvent, map } from 'rxjs';

/** Time the save bar stays in its alert state, a bit longer than the shake. */
const ALERT_DURATION_MS = 900;

/** Options of {@link trackUnsavedChanges}. */
export interface UnsavedChangesOptions<T> {
    /**
     * Puts a snapshot back into the form. Needed when the form holds arrays
     * whose length changes, because reset() only restores existing controls.
     * By default the form is reset to the snapshot.
     */
    restore?: (snapshot: T) => void;
}

/** What the save bar needs from a tracker, whatever the type of its form. */
export interface UnsavedChangesState {
    readonly hasChanges: Signal<boolean>;
    readonly isAlerting: Signal<boolean>;
    discard(): void;
}

/**
 * Follows a form and tells whether it holds changes that would be lost when
 * leaving the page, like the save bar of Discord. Use it together with
 * {@link SaveBarComponent} and the unsavedChangesGuard:
 *
 * ```ts
 * protected readonly unsaved = trackUnsavedChanges(this.form);
 * canLeave = () => this.unsaved.canLeave();
 * ```
 */
export class UnsavedChangesTracker<T> implements UnsavedChangesState {
    /** True when something was typed that would be lost when leaving. */
    readonly hasChanges: Signal<boolean>;

    /** True while the save bar shakes to remind that there are unsaved changes. */
    readonly isAlerting = signal(false);

    private readonly snapshot: ReturnType<typeof signal<string>>;

    private readonly current: Signal<string>;

    private alertTimer?: ReturnType<typeof setTimeout>;

    private lastSnapshot: T;

    constructor(
        private readonly form: AbstractControl<unknown, T>,
        destroyRef: DestroyRef,
        private readonly options: UnsavedChangesOptions<T> = {}
    ) {
        this.lastSnapshot = form.getRawValue();
        this.snapshot = signal(serialize(this.lastSnapshot));
        // valueChanges fires after validation, so the raw value is already current.
        this.current = toSignal(form.valueChanges.pipe(map(() => serialize(form.getRawValue()))), { initialValue: this.snapshot() });
        this.hasChanges = computed(() => this.current() !== this.snapshot());

        // Closing or reloading the tab only allows the browser's own dialog.
        fromEvent<BeforeUnloadEvent>(window, 'beforeunload')
            .pipe(takeUntilDestroyed(destroyRef))
            .subscribe((event) => {
                if (this.hasChanges()) {
                    event.preventDefault();
                    // Safari and older Chromium versions only show the dialog when returnValue is set.
                    event.returnValue = true;
                    this.alert();
                }
            });
        destroyRef.onDestroy(() => clearTimeout(this.alertTimer));
    }

    /**
     * Takes the current value as the saved one: call it after loading a record
     * and after saving it.
     */
    markSaved(): void {
        this.lastSnapshot = this.form.getRawValue();
        this.snapshot.set(serialize(this.lastSnapshot));
    }

    /** Discards the changes, putting the saved value back. */
    discard(): void {
        if (this.options.restore) {
            this.options.restore(this.lastSnapshot);
        } else {
            this.form.reset(this.lastSnapshot);
        }
        this.form.markAsPristine();
        this.form.markAsUntouched();
    }

    /**
     * Called by the unsavedChangesGuard before leaving the page. With pending
     * changes it keeps the user here and shakes the save bar.
     *
     * @returns true when there is nothing to lose
     */
    canLeave(): boolean {
        if (!this.hasChanges()) {
            return true;
        }
        this.alert();
        return false;
    }

    /**
     * Shakes the save bar and paints it in the alert color. Removing the class
     * first and adding it back a moment later restarts the animation when
     * the user insists.
     */
    alert(): void {
        clearTimeout(this.alertTimer);
        this.isAlerting.set(false);
        // A short pause lets the class go away first; unlike requestAnimationFrame it also runs in background tabs.
        this.alertTimer = setTimeout(() => {
            this.isAlerting.set(true);
            this.alertTimer = setTimeout(() => this.isAlerting.set(false), ALERT_DURATION_MS);
        }, 30);
    }
}

/**
 * Creates an {@link UnsavedChangesTracker}. Call it in a field initializer or
 * a constructor, it needs the injection context.
 *
 * @param form    form to follow
 * @param options how to restore arrays when discarding
 * @returns the tracker, tied to the life of the component
 */
export function trackUnsavedChanges<T>(form: AbstractControl<unknown, T>, options?: UnsavedChangesOptions<T>): UnsavedChangesTracker<T> {
    return new UnsavedChangesTracker(form, inject(DestroyRef), options);
}

/**
 * Turns a form value into a comparable string. Text is trimmed so that
 * typing a space and deleting it again does not count as a change.
 */
function serialize(value: unknown): string {
    return JSON.stringify(value, (_key, item: unknown) => (typeof item === 'string' ? item.trim() : item));
}
