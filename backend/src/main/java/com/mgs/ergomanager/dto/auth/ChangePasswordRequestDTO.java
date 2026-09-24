package com.mgs.ergomanager.dto.auth;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * Passwords supplied by the signed in user. Confirmation is handled by the UI.
 *
 * @param currentPassword current or temporary password
 * @param newPassword replacement password matching the HU-019 strength rules
 */
public record ChangePasswordRequestDTO(

        @NotBlank
        @Size(max = 100)
        String currentPassword,

        @NotBlank
        @Size(min = 8, max = 72)
        @Pattern(regexp = "(?s)(?=.*[A-ZÁÉÍÓÚÑ])(?=.*[a-záéíóúñ])(?=.*[0-9])"
                + "(?=.*[^A-Za-zÁÉÍÓÚÑáéíóúñ0-9\\s]).*",
                message = "must contain uppercase, lowercase, number and symbol")
        String newPassword) {
}
