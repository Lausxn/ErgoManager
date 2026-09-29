import { Role } from './role.model';

/**
 * Body sent to POST and PUT /api/users. The supplied temporary password is
 * hashed by the backend and sent to the email of the new user.
 */
export interface UserRequest {
    password: string;
    firstName: string;
    firstLastName: string;
    secondLastName?: string;
    email: string;
    role: Role;
}

/**
 * Body sent to PUT /api/users/{id}. Without a password the stored one is kept;
 * with one, it is replaced and the previous sessions of the user are revoked.
 */
export type UserUpdateRequest = Omit<UserRequest, 'password'> & { password?: string };

/** Administrator or ergonomist returned by /api/users. */
export interface UserResponse {
    id: number;
    firstName: string;
    firstLastName: string;
    secondLastName?: string;
    email: string;
    role: Role;
    active: boolean;
    createdAt: string;
}
