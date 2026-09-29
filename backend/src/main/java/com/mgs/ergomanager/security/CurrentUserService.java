package com.mgs.ergomanager.security;

import com.mgs.ergomanager.model.User;
import com.mgs.ergomanager.repository.UserRepository;
import java.util.Objects;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

/**
 * Gives the services access to the signed in user, so they can apply the
 * ownership rules (an ergonomist only works with their own agenda and
 * evaluations, an administrator works with everything).
 */
@Component
public class CurrentUserService {

    private static final String ADMIN_AUTHORITY = "ROLE_ADMIN";

    private static final String ACCESS_DENIED_MESSAGE = "No tiene permisos para realizar esta acción.";

    private final UserRepository userRepository;

    /**
     * Builds the component with the repository used to load the user.
     *
     * @param userRepository repository of application users
     */
    public CurrentUserService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    /**
     * Returns the email of the signed in user, which is the principal name.
     *
     * @return email of the signed in user
     * @throws AccessDeniedException when the request is anonymous
     */
    public String getCurrentEmail() {
        return requireAuthentication().getName();
    }

    /**
     * Loads the signed in user from the database.
     *
     * @return the signed in user
     * @throws AccessDeniedException when the request is anonymous or the user no longer exists
     */
    public User getCurrentUser() {
        String email = getCurrentEmail();
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new AccessDeniedException(ACCESS_DENIED_MESSAGE));
    }

    /**
     * Tells whether the signed in user holds the administrator role.
     *
     * @return true for an administrator
     */
    public boolean isAdmin() {
        return requireAuthentication().getAuthorities().stream()
                .anyMatch(authority -> ADMIN_AUTHORITY.equals(authority.getAuthority()));
    }

    /**
     * Lets an administrator through, and an ergonomist only when they are the
     * owner of the resource.
     *
     * @param ownerId identifier of the user that owns the resource
     * @throws AccessDeniedException when an ergonomist accesses another user's resource
     */
    public void checkOwnerOrAdmin(Long ownerId) {
        if (isAdmin()) {
            return;
        }
        if (!Objects.equals(getCurrentUser().getId(), ownerId)) {
            throw new AccessDeniedException(ACCESS_DENIED_MESSAGE);
        }
    }

    /**
     * Returns the authentication of the current request.
     *
     * @return authentication of a signed in user
     * @throws AccessDeniedException when the request is anonymous
     */
    private Authentication requireAuthentication() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()
                || authentication instanceof AnonymousAuthenticationToken) {
            throw new AccessDeniedException(ACCESS_DENIED_MESSAGE);
        }
        return authentication;
    }
}
