import { Role } from './role.model';

/** Credentials sent to POST /api/auth/login. */
export interface LoginRequest {
    email: string;
    password: string;
}

/** Passwords sent to PUT /api/auth/password by a signed in user. */
export interface ChangePasswordRequest {
    /** Current password, or the temporary one assigned by an administrator. */
    currentPassword: string;
    newPassword: string;
}

/** Payload returned by POST /api/auth/login and PUT /api/auth/password. */
export interface LoginResponse {
    token: string;
    tokenType: string;
    expiresAtMs: number;
    userId: number;
    fullName: string;
    role: Role;
}
