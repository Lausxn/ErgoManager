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
     * Updates the data of an existing user. A new password is hashed and
     * revokes the sessions of the user; a missing password keeps the current one.
     *
     * @param id          identifier of the user
     * @param request     new data of the user
     * @param actorEmail  email of the administrator performing the change
     * @return the updated user
     */
    UserResponseDTO update(Long id, UserUpdateRequestDTO request, String actorEmail);

    /**
     * Deactivates a user so it can no longer sign in, and revokes their sessions.
     *
     * @param id         identifier of the user
     * @param actorEmail email of the administrator performing the change
     */
    void deactivate(Long id, String actorEmail);

    /**
     * Activates a user that had been deactivated.
     *
     * @param id identifier of the user
     * @return the activated user
     */
    UserResponseDTO activate(Long id);
}
