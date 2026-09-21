import { Role } from './role.model';

/** Credentials sent to POST /api/auth/login. */
export interface LoginRequest {
  email: string;
  password: string;
}

/** Payload returned by POST /api/auth/login. */
export interface LoginResponse {
  token: string;
  tokenType: string;
  expiresAtMs: number;
  userId: number;
  fullName: string;
  role: Role;
}
