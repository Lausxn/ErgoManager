import { FormControl, Validators } from '@angular/forms';

import { Role } from '../../../shared/models/role.model';
import { UserUpdateRequest } from '../../../shared/models/user.model';

/** Limits of UserRequestDTO and UserUpdateRequestDTO in the backend. */
export const USER_LIMITS = {
    name: 60,
    email: 120,
    minPassword: 8,
    maxPassword: 100
} as const;

/** Rejects values made only of spaces, which required alone lets through. */
const NOT_BLANK = Validators.pattern(/\S/);

/** Role option shown as a card, with what the role allows. */
export interface RoleChoice {
    value: Role;
    description: string;
    icon: string;
}

export const ROLE_CHOICES: RoleChoice[] = [
    { value: 'ERGONOMIST', description: 'Realiza evaluaciones personalizadas y gestiona su propia agenda.', icon: 'pi pi-heart' },
    { value: 'ADMIN', description: 'Acceso completo: gestiona empresas, usuarios y formularios.', icon: 'pi pi-shield' }
];

/**
 * Builds the controls shared by the creation and the edition forms: names,
 * email and role, with the same limits the backend validates.
 *
 * @returns new controls, one set per form
 */
export function createIdentityControls() {
    return {
        firstName: new FormControl('', { nonNullable: true, validators: [Validators.required, NOT_BLANK, Validators.maxLength(USER_LIMITS.name)] }),
        firstLastName: new FormControl('', { nonNullable: true, validators: [Validators.required, NOT_BLANK, Validators.maxLength(USER_LIMITS.name)] }),
        secondLastName: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(USER_LIMITS.name)] }),
        email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email, Validators.maxLength(USER_LIMITS.email)] }),
        role: new FormControl<Role>('ERGONOMIST', { nonNullable: true, validators: [Validators.required] })
    };
}

/**
 * Cleans the values typed in the form the same way the backend stores them:
 * trimmed names, email in lower case and no empty second last name.
 *
 * @param value raw values of the identity controls
 * @returns body ready to be sent
 */
export function toIdentityRequest(value: { firstName: string; firstLastName: string; secondLastName: string; email: string; role: Role }): UserUpdateRequest {
    return {
        firstName: value.firstName.trim(),
        firstLastName: value.firstLastName.trim(),
        secondLastName: value.secondLastName.trim() || undefined,
        email: value.email.trim().toLowerCase(),
        role: value.role
    };
}
