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

        @NotBlank(message = "El correo es obligatorio.")
        @Email(message = "El correo no tiene un formato válido.")
        @Size(max = 120, message = "El correo no puede superar los 120 caracteres.")
        String email,

        // No minimum length: a short password is answered as wrong credentials,
        // so the sign in form does not disclose the password policy.
        @NotBlank(message = "La contraseña es obligatoria.")
        @Size(max = 100, message = "La contraseña no puede superar los 100 caracteres.")
        String password) {
}
