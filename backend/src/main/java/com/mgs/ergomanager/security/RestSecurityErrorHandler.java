package com.mgs.ergomanager.security;

import com.mgs.ergomanager.exception.ErrorResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.stereotype.Component;
import tools.jackson.databind.json.JsonMapper;

/**
 * Answers the HTTP 401 and 403 raised by the security filters, before any
 * controller runs, with the same {@link ErrorResponse} the controller advice
 * uses, so the Angular application can always show a message.
 */
@Component
public class RestSecurityErrorHandler implements AuthenticationEntryPoint, AccessDeniedHandler {

    static final String MISSING_SESSION_MESSAGE = "Debe iniciar sesión para continuar.";

    static final String ACCESS_DENIED_MESSAGE = "No tiene permisos para realizar esta acción.";

    private final JsonMapper jsonMapper;

    /**
     * Builds the handler with the mapper configured by Spring Boot.
     *
     * @param jsonMapper mapper used to write the error payload
     */
    public RestSecurityErrorHandler(JsonMapper jsonMapper) {
        this.jsonMapper = jsonMapper;
    }

    @Override
    public void commence(HttpServletRequest request,
                         HttpServletResponse response,
                         AuthenticationException exception) throws IOException {
        Object tokenError = request.getAttribute(JwtAuthenticationFilter.TOKEN_ERROR_ATTRIBUTE);
        String message = tokenError != null ? tokenError.toString() : MISSING_SESSION_MESSAGE;
        write(response, request, HttpStatus.UNAUTHORIZED, message);
    }

    @Override
    public void handle(HttpServletRequest request,
                       HttpServletResponse response,
                       AccessDeniedException exception) throws IOException {
        write(response, request, HttpStatus.FORBIDDEN, ACCESS_DENIED_MESSAGE);
    }

    /**
     * Writes the error payload as the body of the response.
     *
     * @param response response being built
     * @param request  request being processed
     * @param status   HTTP status to return
     * @param message  human readable explanation
     * @throws IOException when the body cannot be written
     */
    private void write(HttpServletResponse response,
                       HttpServletRequest request,
                       HttpStatus status,
                       String message) throws IOException {
        ErrorResponse body = new ErrorResponse(LocalDateTime.now(),
                status.value(),
                status.getReasonPhrase(),
                message,
                request.getRequestURI(),
                null);
        response.setStatus(status.value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        jsonMapper.writeValue(response.getOutputStream(), body);
    }
}
