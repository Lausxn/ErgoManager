import { AbstractControl, FormArray, FormGroup, Validators } from '@angular/forms';

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

/**
 * Turns the first error of a control into an actionable message in Spanish.
 * Server messages win, because they explain rules the client cannot check.
 *
 * @param control   control to describe
 * @param overrides messages for specific error keys, such as duplicated
 * @returns message ready for the template, empty when the control is valid
 */
export function fieldErrorMessage(control: AbstractControl | null, overrides: Record<string, string> = {}): string {
    if (!control?.errors) {
        return '';
    }
    for (const key of Object.keys(overrides)) {
        if (control.hasError(key)) {
            return overrides[key];
        }
    }
    if (control.hasError('server')) return control.getError('server');
    if (control.hasError('required') || control.hasError('pattern')) return 'Este campo es obligatorio.';
    if (control.hasError('email')) return 'Escriba un correo válido, por ejemplo nombre@empresa.com.';
    if (control.hasError('minlength')) return `Use al menos ${control.getError('minlength').requiredLength} caracteres.`;
    if (control.hasError('maxlength')) return `Use un máximo de ${control.getError('maxlength').requiredLength} caracteres.`;
    if (control.hasError('min')) return `El valor mínimo es ${control.getError('min').min}.`;
    if (control.hasError('max')) return `El valor máximo es ${control.getError('max').max}.`;
    return 'Revise este campo.';
}

/** Rejects values made only of spaces, which required alone lets through. */
export const notBlank = Validators.pattern(/\S/);
