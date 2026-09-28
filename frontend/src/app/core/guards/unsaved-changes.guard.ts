import { CanDeactivateFn } from '@angular/router';

/** Page that can hold changes the user has not saved yet. */
export interface HasUnsavedChanges {
    /**
     * Decides whether the user can leave the page. A page with pending changes
     * returns false and warns the user in its own way.
     *
     * @returns true when there is nothing to lose
     */
    canLeave(): boolean;
}

/**
 * Keeps the user on the page while it has unsaved changes, until they save or
 * discard them.
 */
export const unsavedChangesGuard: CanDeactivateFn<HasUnsavedChanges> = (component) => component.canLeave();
