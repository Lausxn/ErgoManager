package com.mgs.ergomanager.exception;

/**
 * Thrown when a business rule is broken, for example booking an appointment on
 * a slot that is already taken. It is translated into an HTTP 400 response by
 * {@link GlobalExceptionHandler}.
 */
public class BusinessException extends RuntimeException {

    /**
     * Builds the exception with a ready to use message.
     *
     * @param message text describing the broken rule
     */
    public BusinessException(String message) {
        super(message);
    }
}
