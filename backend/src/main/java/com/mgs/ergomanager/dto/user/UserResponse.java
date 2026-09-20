package com.mgs.ergomanager.dto.user;

import com.mgs.ergomanager.model.enums.Role;
import java.time.LocalDateTime;

/**
 * Administrator or ergonomist exposed by the API. The password is never
 * included in a response.
 *
 * @param id             identifier of the user
 * @param firstName      given name of the user
 * @param firstLastName  first surname of the user
 * @param secondLastName second surname of the user
 * @param email          email used as sign in credential
 * @param role           role granted to the user
 * @param active         false when the user was deactivated
 * @param createdAt      moment the user was registered
 */
public record UserResponse(
        Long id,
        String firstName,
        String firstLastName,
        String secondLastName,
        String email,
        Role role,
        boolean active,
        LocalDateTime createdAt) {
}
