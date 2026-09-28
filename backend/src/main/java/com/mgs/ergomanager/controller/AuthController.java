package com.mgs.ergomanager.controller;

import com.mgs.ergomanager.dto.auth.LoginRequestDTO;
import com.mgs.ergomanager.dto.auth.LoginResponseDTO;
import com.mgs.ergomanager.service.AuthService;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Sign in endpoints of the administrators and the ergonomists.
 */
@RestController
@RequestMapping("/api/auth")
@Tag(name = "Auth", description = "Sign in and token issuing")
public class AuthController {

    private final AuthService authService;

    /**
     * Builds the controller with its service.
     *
     * @param authService service that validates the credentials
     */
    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    /**
     * Validates the credentials and returns a JWT.
     *
     * @param request credentials sent by the user
     * @return token and profile data of the authenticated user
     */
    @PostMapping("/login")
    public ResponseEntity<LoginResponseDTO> login(@Valid @RequestBody LoginRequestDTO request) {
        return ResponseEntity.ok(authService.login(request));
    }
}
