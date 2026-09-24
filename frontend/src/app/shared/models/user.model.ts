import { Role } from './role.model';

/** Body sent to POST and PUT /api/users. */
export interface UserRequest {
    firstName: string;
    firstLastName: string;
    secondLastName?: string;
    email: string;
    /** Required on create; left out on update to keep the current password. */
    password?: string;
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
