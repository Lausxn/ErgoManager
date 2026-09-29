package com.mgs.ergomanager.dto.user;

import com.mgs.ergomanager.model.enums.Role;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * Data needed to update an existing administrator or ergonomist.
 *
 * @param firstName      given name of the user
 * @param firstLastName  first surname of the user
 * @param secondLastName second surname of the user, optional
 * @param email          email used as sign in credential
 * @param role           role granted to the user
 */
public record UserUpdateRequestDTO(

        @NotBlank
        @Size(max = 60)
        String firstName,

        @NotBlank
        @Size(max = 60)
        String firstLastName,

        @Size(max = 60)
        String secondLastName,

        @NotBlank
        @Email
        @Size(max = 120)
        String email,

        @NotNull
        Role role) {
}