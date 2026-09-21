import { AbstractControl, FormArray, FormGroup } from '@angular/forms';

/**
 * Marks every control of a form as touched and dirty, so PrimeNG paints the
 * invalid fields and the templates show their messages.
 *
 * @param control form, array or control to mark
 */
export function markFormAsDirty(control: AbstractControl): void {
    control.markAsDirty();
    control.markAsTouched();
    if (control instanceof FormGroup || control instanceof FormArray) {
        Object.values(control.controls).forEach((child) => markFormAsDirty(child));
    }
}

/**
 * Checks whether a control holds an invalid value the user already worked on.
 *
 * @param control control to check
 * @returns true when its error has to be shown
 */
export function isControlInvalid(control: AbstractControl | null): boolean {
    return control !== null && control.invalid && (control.touched || control.dirty);
}
