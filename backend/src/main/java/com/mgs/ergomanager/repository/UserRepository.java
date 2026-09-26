package com.mgs.ergomanager.repository;

import com.mgs.ergomanager.model.User;
import com.mgs.ergomanager.model.enums.Role;
import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

/**
 * Data access operations for the {@link User} entity.
 */
@Repository
public interface UserRepository extends JpaRepository<User, Long> {

    /**
     * Locks an edited user so concurrent updates cannot lose session revocations.
     *
     * @param id identifier of the edited user
     * @return user locked until the update transaction completes
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select user from User user where user.id = :id")
    Optional<User> findByIdForUpdate(@Param("id") Long id);

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
