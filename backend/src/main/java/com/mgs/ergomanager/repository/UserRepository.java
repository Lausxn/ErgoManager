package com.mgs.ergomanager.repository;

import com.mgs.ergomanager.model.User;
import com.mgs.ergomanager.model.enums.Role;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

/**
 * Data access operations for the {@link User} entity.
 */
@Repository
public interface UserRepository extends JpaRepository<User, Long> {

    /**
     * Finds a user by the email used as sign in credential.
     *
     * @param email email to look for
     * @return the user when it exists
     */
    Optional<User> findByEmail(String email);

    /**
     * Checks whether the email is already taken.
     *
     * @param email email to look for
     * @return true when another user already uses that email
     */
    boolean existsByEmail(String email);

    /**
     * Returns the active users that hold the given role.
     *
     * @param role role to filter by
     * @return list of users
     */
    List<User> findByRoleAndActiveTrue(Role role);

    /**
     * Counts the active users that hold the given role.
     *
     * @param role role to filter by
     * @return number of active users with the given role
     */
    long countByRoleAndActiveTrue(Role role);
}