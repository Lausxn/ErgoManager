package com.mgs.ergomanager.exception;

/**
 * Thrown when a requested record does not exist. It is translated into an HTTP
 * 404 response by {@link GlobalExceptionHandler}.
 */
public class ResourceNotFoundException extends RuntimeException {

    /**
     * Builds the exception with a ready to use message.
     *
     * @param message text describing the missing record
     */
    public ResourceNotFoundException(String message) {
        super(message);
    }
}
