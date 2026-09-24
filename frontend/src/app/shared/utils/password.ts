import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/** Shortest password accepted by ErgoManager. */
export const MIN_PASSWORD_LENGTH = 8;

/** One of the requirements listed under the new password field. */
export interface PasswordRule {
    key: string;
    label: string;
    test: (value: string) => boolean;
}

/**
 * Requirements of a new password. The backend has to enforce the same rules;
 * this list only gives the user immediate feedback.
 */
export const PASSWORD_RULES: readonly PasswordRule[] = [
    { key: 'length', label: `Mínimo ${MIN_PASSWORD_LENGTH} caracteres`, test: (value) => value.length >= MIN_PASSWORD_LENGTH },
    { key: 'uppercase', label: 'Una letra mayúscula', test: (value) => /[A-ZÁÉÍÓÚÑ]/.test(value) },
    { key: 'lowercase', label: 'Una letra minúscula', test: (value) => /[a-záéíóúñ]/.test(value) },
    { key: 'number', label: 'Un número', test: (value) => /\d/.test(value) },
    { key: 'symbol', label: 'Un símbolo (!@#$...)', test: (value) => /[^A-Za-zÁÉÍÓÚÑáéíóúñ\d\s]/.test(value) }
];

/** Strength of a password, from 0 (empty) to 4 (every rule met). */
export type PasswordStrength = 0 | 1 | 2 | 3 | 4;

/** Label shown next to the strength meter for each level. */
export const PASSWORD_STRENGTH_LABELS: Record<PasswordStrength, string> = {
    0: 'Aún no evaluada',
    1: 'Débil',
    2: 'Media',
    3: 'Buena',
    4: 'Fuerte'
};

/**
 * Measures a password by counting the rules it meets.
 *
 * @param value password typed by the user
 * @returns 0 when empty, 1 with two rules or fewer, up to 4 with all of them
 */
export function getPasswordStrength(value: string): PasswordStrength {
    if (!value) {
        return 0;
    }
    const metRules = PASSWORD_RULES.filter((rule) => rule.test(value)).length;
    return Math.max(1, metRules - 1) as PasswordStrength;
}

/**
 * Fails with `weakPassword` while the value misses one of the PASSWORD_RULES.
 * An empty value is left to Validators.required.
 */
export const strongPasswordValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
    const value: string = control.value ?? '';
    if (!value) {
        return null;
    }
    const missingRules = PASSWORD_RULES.filter((rule) => !rule.test(value)).map((rule) => rule.key);
    return missingRules.length === 0 ? null : { weakPassword: missingRules };
};

/**
 * Group validator that compares two fields of the same form.
 *
 * @param field     name of the control whose value is checked
 * @param reference name of the control it is compared with
 * @param mustMatch true when both must be equal, false when they must differ
 * @param errorKey  key of the error set on the group
 * @returns validator ready for the `validators` option of a FormGroup
 */
export function compareFieldsValidator(field: string, reference: string, mustMatch: boolean, errorKey: string): ValidatorFn {
    return (group: AbstractControl): ValidationErrors | null => {
        const value = group.get(field)?.value;
        const referenceValue = group.get(reference)?.value;
        if (!value || !referenceValue) {
            return null;
        }
        return (value === referenceValue) === mustMatch ? null : { [errorKey]: true };
    };
}
