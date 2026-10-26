package com.mgs.ergomanager.security;

import java.nio.charset.StandardCharsets;

/**
 * Password limits shared by every place that hashes or checks a password.
 */
public final class PasswordRules {

    /** BCrypt only reads the first 72 bytes; accented letters or ñ take two bytes each. */
    public static final int MAX_BYTES = 72;

    private PasswordRules() {
    }

    /**
     * Tells whether a password is longer than BCrypt can read.
     *
     * @param password password to check
     * @return true when its UTF-8 form exceeds {@link #MAX_BYTES}
     */
    public static boolean exceedsMaxBytes(String password) {
        return password.getBytes(StandardCharsets.UTF_8).length > MAX_BYTES;
    }
}
