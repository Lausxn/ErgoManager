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

    /**
     * Builds the exception with the usual "Entity not found with id X" message.
     *
     * @param resourceName name of the entity that was searched
     * @param id           identifier that produced no result
     */
    public ResourceNotFoundException(String resourceName, Object id) {
        super(resourceName + " not found with id " + id);
    }
}
