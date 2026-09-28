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

        @NotBlank(message = "La contraseña actual es obligatoria.")
        @Size(max = 100, message = "La contraseña actual no puede superar los 100 caracteres.")
        String currentPassword,

        @NotBlank(message = "La nueva contraseña es obligatoria.")
        @Size(min = 8, max = 72, message = "La nueva contraseña debe tener entre 8 y 72 caracteres.")
        @Pattern(regexp = "(?s)(?=.*[A-ZÁÉÍÓÚÑ])(?=.*[a-záéíóúñ])(?=.*[0-9])"
                + "(?=.*[^A-Za-zÁÉÍÓÚÑáéíóúñ0-9\\s]).*",
                message = "La nueva contraseña debe incluir mayúsculas, minúsculas, números y símbolos.")
        String newPassword) {
}
