import { HttpErrorResponse } from '@angular/common/http';
import { AbstractControl } from '@angular/forms';

import { ApiError } from '../models/api-error.model';

const CONNECTION_ERROR_MESSAGE = 'No fue posible conectar con el servidor. Revise su conexión e intente de nuevo.';

/**
 * Reads the message the backend sent in its {@link ApiError} payload.
 *
 * @param error error received by the subscriber of an HTTP call
 * @param fallback text shown when the response carries no message
 * @returns message ready to show to the user
 */
export function getApiErrorMessage(error: unknown, fallback: string): string {
    if (!(error instanceof HttpErrorResponse)) {
        return fallback;
    }
    // Status 0 means the request never reached the backend.
    if (error.status === 0) {
        return CONNECTION_ERROR_MESSAGE;
    }
    const body = error.error as Partial<ApiError> | null;
    return typeof body?.message === 'string' && body.message.trim() !== '' ? body.message : fallback;
}

/**
 * Reads the validation messages the backend sent for each invalid field.
 *
 * @param error error received by the subscriber of an HTTP call
 * @returns messages indexed by field name, empty when there are none
 */
export function getApiFieldErrors(error: unknown): Record<string, string> {
    if (!(error instanceof HttpErrorResponse)) {
        return {};
    }
    const body = error.error as Partial<ApiError> | null;
    return body?.fieldErrors ?? {};
}

/**
 * Shows the errors of a failed save on the form: every field the backend
 * rejected gets a "server" error with its message, so the template can print
 * it under the field.
 *
 * @param form     form that was sent
 * @param error    error received by the subscriber of the HTTP call
 * @param fallback text used when the response carries no message
 * @returns general message to show above the actions
 */
export function applyApiErrors(form: AbstractControl, error: unknown, fallback: string): string {
    for (const [field, message] of Object.entries(getApiFieldErrors(error))) {
        const control = form.get(field);
        if (control) {
            control.setErrors({ ...control.errors, server: message });
            control.markAsTouched();
        }
    }
    return getApiErrorMessage(error, fallback);
}

/**
 * Tells whether a failed call was rejected because a unique value is taken.
 *
 * @param error error received by the subscriber of an HTTP call
 * @returns true for HTTP 409
 */
export function isConflict(error: unknown): boolean {
    return error instanceof HttpErrorResponse && error.status === 409;
}
