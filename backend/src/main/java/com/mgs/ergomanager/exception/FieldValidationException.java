package com.mgs.ergomanager.exception;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Thrown when the service layer finds invalid fields that the request
 * annotations cannot check, for example a format that only applies to new
 * values. It is translated into an HTTP 400 response with one message per
 * field, the same shape as the request validation errors.
 */
public class FieldValidationException extends BusinessException {

    private final transient Map<String, String> fieldErrors;

    /**
     * Builds the exception with the message of each invalid field.
     *
     * @param fieldErrors message by field name, in the order they are shown
     */
    public FieldValidationException(Map<String, String> fieldErrors) {
        super("Revise los datos ingresados.");
        this.fieldErrors = Collections.unmodifiableMap(new LinkedHashMap<>(fieldErrors));
    }

    /**
     * Returns the message of each invalid field.
     *
     * @return message by field name
     */
    public Map<String, String> getFieldErrors() {
        return fieldErrors;
    }
}
