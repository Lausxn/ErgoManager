package com.mgs.ergomanager.dto.user;

import com.mgs.ergomanager.model.enums.Role;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.Locale;

/**
 * Data needed to create an administrator or an ergonomist.
 *
 * @param firstName      given name of the user
 * @param firstLastName  first surname of the user
 * @param secondLastName second surname of the user, optional
 * @param email          email used as sign in credential
 * @param password       plain password, hashed before being stored
 * @param role           role granted to the user
 */
public record UserRequestDTO(

        @NotBlank(message = "Este campo es obligatorio.")
        @Size(max = 60, message = "Use un máximo de 60 caracteres.")
        String firstName,

        @NotBlank(message = "Este campo es obligatorio.")
        @Size(max = 60, message = "Use un máximo de 60 caracteres.")
        String firstLastName,

        @Size(max = 60, message = "Use un máximo de 60 caracteres.")
        String secondLastName,

        @NotBlank(message = "Este campo es obligatorio.")
        @Email(message = "Escriba un correo válido.")
        @Size(max = 120, message = "Use un máximo de 120 caracteres.")
        String email,

        @NotBlank(message = "Este campo es obligatorio.")
        @Size(min = 8, max = 100, message = "La contraseña debe tener entre 8 y 100 caracteres.")
        String password,

        @NotNull(message = "Seleccione un rol.")
        Role role) {

    /** Normalizes identity fields before validation; passwords stay untouched. */
    public UserRequestDTO {
        firstName = firstName == null ? null : firstName.trim();
        firstLastName = firstLastName == null ? null : firstLastName.trim();
        secondLastName = secondLastName == null || secondLastName.isBlank() ? null : secondLastName.trim();
        email = email == null ? null : email.trim().toLowerCase(Locale.ROOT);
    }
}
