package com.mgs.ergomanager.exception;

/**
 * Thrown when a unique value, such as an email or a tax id, is already taken.
 * It is translated into an HTTP 409 response by {@link GlobalExceptionHandler}.
 */
public class DuplicateResourceException extends RuntimeException {

    /**
     * Builds the exception with a ready to use message.
     *
     * @param message text describing the conflicting value
     */
    public DuplicateResourceException(String message) {
        super(message);
    }
}
