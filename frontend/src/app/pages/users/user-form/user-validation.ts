import { AbstractControl, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';

/** Validate the normalized email that the API receives. */
export const userEmailValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
    const value = typeof control.value === 'string' ? control.value.trim() : '';
    if (!value) return { required: true };
    if (value.length > 120) return { maxlength: { requiredLength: 120 } };
    return Validators.email({ value } as AbstractControl);
};

/** BCrypt measures UTF-8 bytes, not the number of characters. */
export const passwordByteLimit: ValidatorFn = (control: AbstractControl): ValidationErrors | null => (new TextEncoder().encode(control.value ?? '').length > 72 ? { passwordBytes: true } : null);
