import { Role } from './role.model';

/** Body sent to PUT /api/users/{id}, mirrors UserUpdateRequestDTO. The password is not edited here. */
export interface UserUpdateRequest {
    firstName: string;
    firstLastName: string;
    secondLastName?: string;
    email: string;
    role: Role;
}

/** Body sent to POST /api/users, mirrors UserRequestDTO. */
export interface UserRequest extends UserUpdateRequest {
    password: string;
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
