package com.mgs.ergomanager.service;

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
}
