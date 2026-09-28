package com.mgs.ergomanager.exception;

import jakarta.servlet.http.HttpServletRequest;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.authentication.InternalAuthenticationServiceException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.validation.FieldError;
import org.springframework.web.HttpMediaTypeNotSupportedException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/**
 * Turns every exception raised by a controller into an {@link ErrorResponse},
 * so the API never leaks stack traces to the Angular application.
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger LOGGER = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    private static final String UNEXPECTED_ERROR_MESSAGE = "Ocurrió un error inesperado. Intente de nuevo o contacte al administrador.";

    private static final String VALIDATION_MESSAGE = "Revise los datos ingresados.";

    private static final String BAD_CREDENTIALS_MESSAGE = "El correo o la contraseña son incorrectos.";

    private static final String DISABLED_ACCOUNT_MESSAGE = "La cuenta está desactivada. Contacte al administrador.";

    private static final String AUTHENTICATION_FAILED_MESSAGE = "No fue posible iniciar sesión.";

    private static final String ACCESS_DENIED_MESSAGE = "No tiene permisos para realizar esta acción.";

    private static final String UNREADABLE_BODY_MESSAGE = "El cuerpo de la solicitud no es válido.";

    /**
     * Handles a request for a record that does not exist.
     *
     * @param exception exception raised by the service layer
     * @param request   request being processed
     * @return response with HTTP status 404
     */
    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<ErrorResponse> handleResourceNotFound(ResourceNotFoundException exception,
                                                               HttpServletRequest request) {
        return buildResponse(HttpStatus.NOT_FOUND, exception.getMessage(), request, null);
    }

    /**
     * Handles an attempt to reuse a value that must be unique.
     *
     * @param exception exception raised by the service layer
     * @param request   request being processed
     * @return response with HTTP status 409
     */
    @ExceptionHandler(DuplicateResourceException.class)
    public ResponseEntity<ErrorResponse> handleDuplicateResource(DuplicateResourceException exception,
                                                                HttpServletRequest request) {
        return buildResponse(HttpStatus.CONFLICT, exception.getMessage(), request, null);
    }

    /**
     * Handles a broken business rule.
     *
     * @param exception exception raised by the service layer
     * @param request   request being processed
     * @return response with HTTP status 400
     */
    @ExceptionHandler(BusinessException.class)
    public ResponseEntity<ErrorResponse> handleBusiness(BusinessException exception,
                                                       HttpServletRequest request) {
        return buildResponse(HttpStatus.BAD_REQUEST, exception.getMessage(), request, null);
    }

    /**
     * Handles a request body that failed the Jakarta Validation constraints.
     *
     * @param exception exception raised by the validation framework
     * @param request   request being processed
     * @return response with HTTP status 400 and one message per invalid field
     */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleValidation(MethodArgumentNotValidException exception,
                                                          HttpServletRequest request) {
        Map<String, String> fieldErrors = new LinkedHashMap<>();
        for (FieldError fieldError : exception.getBindingResult().getFieldErrors()) {
            // An empty value breaks several constraints at once: report that it is required.
            if (isRequiredConstraint(fieldError)) {
                fieldErrors.put(fieldError.getField(), fieldError.getDefaultMessage());
            } else {
                fieldErrors.putIfAbsent(fieldError.getField(), fieldError.getDefaultMessage());
            }
        }
        return buildResponse(HttpStatus.BAD_REQUEST, VALIDATION_MESSAGE, request, fieldErrors);
    }

    /**
     * Handles a request body that is missing, is not valid JSON or does not
     * match the expected types.
     *
     * @param exception exception raised while reading the body
     * @param request   request being processed
     * @return response with HTTP status 400
     */
    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ErrorResponse> handleUnreadableBody(HttpMessageNotReadableException exception,
                                                              HttpServletRequest request) {
        return buildResponse(HttpStatus.BAD_REQUEST, UNREADABLE_BODY_MESSAGE, request, null);
    }

    /**
     * Handles a request body sent with a content type other than JSON.
     *
     * @param exception exception raised by Spring MVC
     * @param request   request being processed
     * @return response with HTTP status 415
     */
    @ExceptionHandler(HttpMediaTypeNotSupportedException.class)
    public ResponseEntity<ErrorResponse> handleUnsupportedMediaType(HttpMediaTypeNotSupportedException exception,
                                                                    HttpServletRequest request) {
        return buildResponse(HttpStatus.UNSUPPORTED_MEDIA_TYPE,
                "La solicitud debe enviarse en formato JSON.", request, null);
    }

    /**
     * Handles a request made with an HTTP method the endpoint does not accept.
     *
     * @param exception exception raised by Spring MVC
     * @param request   request being processed
     * @return response with HTTP status 405
     */
    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<ErrorResponse> handleMethodNotSupported(HttpRequestMethodNotSupportedException exception,
                                                                  HttpServletRequest request) {
        return buildResponse(HttpStatus.METHOD_NOT_ALLOWED,
                "El método " + exception.getMethod() + " no está permitido en este recurso.", request, null);
    }

    /**
     * Handles a request made with invalid or missing credentials.
     *
     * @param exception exception raised by Spring Security
     * @param request   request being processed
     * @return response with HTTP status 401
     */
    @ExceptionHandler(AuthenticationException.class)
    public ResponseEntity<ErrorResponse> handleAuthentication(AuthenticationException exception,
                                                              HttpServletRequest request) {
        if (exception instanceof InternalAuthenticationServiceException) {
            // The users could not be read, for example because the database is down.
            return handleUnexpected(exception, request);
        }
        String message;
        if (exception instanceof BadCredentialsException) {
            message = BAD_CREDENTIALS_MESSAGE;
        } else if (exception instanceof DisabledException) {
            message = DISABLED_ACCOUNT_MESSAGE;
        } else {
            message = AUTHENTICATION_FAILED_MESSAGE;
        }
        return buildResponse(HttpStatus.UNAUTHORIZED, message, request, null);
    }

    /**
     * Handles a request made by a user whose role is not allowed.
     *
     * @param exception exception raised by Spring Security
     * @param request   request being processed
     * @return response with HTTP status 403
     */
    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ErrorResponse> handleAccessDenied(AccessDeniedException exception,
                                                            HttpServletRequest request) {
        return buildResponse(HttpStatus.FORBIDDEN, ACCESS_DENIED_MESSAGE, request, null);
    }

    /**
     * Handles every exception that has no dedicated handler.
     *
     * @param exception exception that reached the controller advice
     * @param request   request being processed
     * @return response with HTTP status 500
     */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleUnexpected(Exception exception, HttpServletRequest request) {
        LOGGER.error("Unhandled exception while processing {}", request.getRequestURI(), exception);
        return buildResponse(HttpStatus.INTERNAL_SERVER_ERROR, UNEXPECTED_ERROR_MESSAGE, request, null);
    }

    /**
     * Tells whether a validation error comes from a "value is required" constraint.
     *
     * @param fieldError validation error of a single field
     * @return true for the NotBlank, NotNull and NotEmpty constraints
     */
    private boolean isRequiredConstraint(FieldError fieldError) {
        String code = fieldError.getCode();
        return "NotBlank".equals(code) || "NotNull".equals(code) || "NotEmpty".equals(code);
    }

    /**
     * Builds the payload shared by every handler of this class.
     *
     * @param status      HTTP status to return
     * @param message     human readable explanation
     * @param request     request being processed
     * @param fieldErrors validation messages, or null when there are none
     * @return response entity ready to be returned
     */
    private ResponseEntity<ErrorResponse> buildResponse(HttpStatus status,
                                                        String message,
                                                        HttpServletRequest request,
                                                        Map<String, String> fieldErrors) {
        ErrorResponse body = new ErrorResponse(LocalDateTime.now(),
                status.value(),
                status.getReasonPhrase(),
                message,
                request.getRequestURI(),
                fieldErrors);
        return ResponseEntity.status(status).body(body);
    }
}
