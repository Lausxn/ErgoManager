package com.mgs.ergomanager.service;

import com.mgs.ergomanager.dto.auth.ChangePasswordRequestDTO;
import com.mgs.ergomanager.dto.auth.LoginRequestDTO;
import com.mgs.ergomanager.dto.auth.LoginResponseDTO;

/**
 * Sign in operations of the administrators and the ergonomists.
 */
public interface AuthService {

    /**
     * Validates the credentials and issues a JWT for the user.
     *
     * @param request credentials sent by the user
     * @return token and profile data of the authenticated user
     */
    LoginResponseDTO login(LoginRequestDTO request);

    /**
     * Validates and replaces the signed in user's password.
     *
     * @param email identity obtained from the authenticated principal
     * @param request current and replacement passwords
     * @return new session, invalidating previous tokens
     */
    LoginResponseDTO changePassword(String email, ChangePasswordRequestDTO request);
}
