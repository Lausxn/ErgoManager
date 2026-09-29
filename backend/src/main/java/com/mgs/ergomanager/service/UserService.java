package com.mgs.ergomanager.service;

import com.mgs.ergomanager.dto.user.UserRequestDTO;
import com.mgs.ergomanager.dto.user.UserResponseDTO;
import com.mgs.ergomanager.dto.user.UserUpdateRequestDTO;
import java.util.List;

/**
 * Management of the administrators and the ergonomists.
 */
public interface UserService {

    /**
     * Returns every registered user, newest first.
     *
     * @return list of users
     */
    List<UserResponseDTO> findAll();

    /**
     * Returns a single user.
     *
     * @param id identifier of the user
     * @return the user
     */
    UserResponseDTO findById(Long id);

    /**
     * Registers a new user and hashes the received password.
     *
     * @param request data of the user
     * @return the created user
     */
    UserResponseDTO create(UserRequestDTO request);

    /**
     * Updates the data and the role of an existing user. The password is not
     * edited here. Changing the role revokes the sessions of the user.
     *
     * @param id      identifier of the user
     * @param request new data of the user
     * @return the updated user
     */
    UserResponseDTO update(Long id, UserUpdateRequestDTO request);

    /**
     * Deactivates a user so it can no longer sign in, keeping the row.
     *
     * @param id               identifier of the user
     * @param currentUserEmail email of the administrator making the request
     */
    void deactivate(Long id, String currentUserEmail);

    /**
     * Activates a user that had been deactivated. The sessions revoked by the
     * deactivation stay revoked: the user has to sign in again.
     *
     * @param id identifier of the user
     * @return the activated user
     */
    UserResponseDTO activate(Long id);
}
