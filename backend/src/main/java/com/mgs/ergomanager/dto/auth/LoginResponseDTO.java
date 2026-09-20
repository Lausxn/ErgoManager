package com.mgs.ergomanager.dto.auth;

import com.mgs.ergomanager.model.enums.Role;

/**
 * Token and profile data returned after a successful sign in.
 *
 * @param token       signed JWT to send in the Authorization header
 * @param tokenType   scheme expected by the API, always Bearer
 * @param expiresAtMs expiration instant of the token, in epoch milliseconds
 * @param userId      identifier of the authenticated user
 * @param fullName    display name of the authenticated user
 * @param role        role granted to the authenticated user
 */
public record LoginResponse(
        String token,
        String tokenType,
        long expiresAtMs,
        Long userId,
        String fullName,
        Role role) {
}
