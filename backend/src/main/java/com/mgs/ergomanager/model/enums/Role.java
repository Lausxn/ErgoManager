package com.mgs.ergomanager.model.enums;

/**
 * Roles supported by the application. They are mapped to Spring Security
 * authorities by prefixing the constant with {@code ROLE_}.
 */
public enum Role {

    /** Full access: manages companies, users and forms. */
    ADMIN,

    /** Performs personalized evaluations and manages their own agenda. */
    ERGONOMIST
}
