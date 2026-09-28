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
