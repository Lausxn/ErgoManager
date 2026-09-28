package com.mgs.ergomanager.exception;

import java.time.LocalDateTime;
import java.util.Map;

/**
 * Single error payload returned by the API, so that the Angular application
 * always reads failures in the same shape.
 *
 * @param timestamp   moment the error was produced
 * @param status      HTTP status code
 * @param error       short name of the HTTP status
 * @param message     human readable explanation
 * @param path        request path that produced the error
 * @param fieldErrors validation messages indexed by field name, may be null
 */
public record ErrorResponse(
        LocalDateTime timestamp,
        int status,
        String error,
        String message,
        String path,
        Map<String, String> fieldErrors) {
}
