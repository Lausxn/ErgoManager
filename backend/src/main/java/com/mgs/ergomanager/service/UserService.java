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
     * Returns every registered user.
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
     * Updates the data of an existing user.
     *
     * @param id      identifier of the user
     * @param request new data of the user
     * @return the updated user
     */
    UserResponseDTO update(Long id, UserUpdateRequestDTO request);

    /**
     * Deactivates a user so it can no longer sign in.
     *
     * @param id identifier of the user
     */
    void deactivate(Long id);
}
