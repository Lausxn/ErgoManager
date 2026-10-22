package com.mgs.ergomanager.exception;

/**
 * Thrown when a unique value, such as an email or a tax id, is already taken.
 * It is translated into an HTTP 409 response by {@link GlobalExceptionHandler}.
 */
public class DuplicateResourceException extends RuntimeException {

    private final String field;

    /**
     * Builds the exception with a ready to use message.
     *
     * @param message text describing the conflicting value
     */
    public DuplicateResourceException(String message) {
        this(message, null);
    }

    /**
     * Builds the exception naming the request field that holds the taken value,
     * so the client can show the message under that field.
     *
     * @param message text describing the conflicting value
     * @param field   name of the request field, or null when it is not known
     */
    public DuplicateResourceException(String message, String field) {
        super(message);
        this.field = field;
    }

    /**
     * Returns the request field that holds the taken value.
     *
     * @return field name, or null when it is not known
     */
    public String getField() {
        return field;
    }
}
