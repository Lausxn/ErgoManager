package com.mgs.ergomanager.service;

import com.mgs.ergomanager.dto.user.UserRequest;
import com.mgs.ergomanager.dto.user.UserResponse;
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
    List<UserResponse> findAll();

    /**
     * Returns a single user.
     *
     * @param id identifier of the user
     * @return the user
     */
    UserResponse findById(Long id);

    /**
     * Registers a new user and hashes the received password.
     *
     * @param request data of the user
     * @return the created user
     */
    UserResponse create(UserRequest request);

    /**
     * Updates the data of an existing user.
     *
     * @param id      identifier of the user
     * @param request new data of the user
     * @return the updated user
     */
    UserResponse update(Long id, UserRequest request);

    /**
     * Deactivates a user so it can no longer sign in.
     *
     * @param id identifier of the user
     */
    void deactivate(Long id);
}
