package com.mgs.ergomanager.security;

import com.mgs.ergomanager.model.User;
import java.util.List;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

/**
 * Spring Security identity including the persisted session version.
 */
public class UserPrincipal extends org.springframework.security.core.userdetails.User {

    private final long tokenVersion;

    /**
     * Copies credentials, account state and session version from the database.
     *
     * @param user application user
     */
    public UserPrincipal(User user) {
        super(user.getEmail(), user.getPassword(), user.isActive(), true, true, true,
                List.of(new SimpleGrantedAuthority("ROLE_" + user.getRole().name())));
        this.tokenVersion = user.getTokenVersion();
    }

    /** @return session version used to validate a JWT */
    public long getTokenVersion() {
        return tokenVersion;
    }
}
