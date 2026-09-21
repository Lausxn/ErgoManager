package com.mgs.ergomanager.dto.auth;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Credentials sent by an administrator or an ergonomist to sign in.
 *
 * @param email    registered email of the user
 * @param password plain password, checked against the stored hash
 */
public record LoginRequestDTO(

        @NotBlank
        @Email
        @Size(max = 120)
        String email,

        @NotBlank
        @Size(min = 8, max = 100)
        String password) {
}
