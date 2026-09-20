package com.mgs.ergomanager.service.impl;

import com.mgs.ergomanager.dto.auth.LoginRequest;
import com.mgs.ergomanager.dto.auth.LoginResponse;
import com.mgs.ergomanager.exception.ResourceNotFoundException;
import com.mgs.ergomanager.model.User;
import com.mgs.ergomanager.repository.UserRepository;
import com.mgs.ergomanager.security.JwtService;
import com.mgs.ergomanager.service.AuthService;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Default implementation of {@link AuthService}.
 */
@Service
public class AuthServiceImpl implements AuthService {

    private static final String TOKEN_TYPE = "Bearer";

    private final AuthenticationManager authenticationManager;

    private final UserRepository userRepository;

    private final JwtService jwtService;

    /**
     * Builds the service with its collaborators.
     *
     * @param authenticationManager manager that validates the credentials
     * @param userRepository        repository of application users
     * @param jwtService            service that issues the tokens
     */
    public AuthServiceImpl(AuthenticationManager authenticationManager,
                           UserRepository userRepository,
                           JwtService jwtService) {
        this.authenticationManager = authenticationManager;
        this.userRepository = userRepository;
        this.jwtService = jwtService;
    }

    @Override
    @Transactional(readOnly = true)
    public LoginResponse login(LoginRequest request) {
        authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.email(), request.password()));

        User user = userRepository.findByEmail(request.email())
                .orElseThrow(() -> new ResourceNotFoundException("User", request.email()));

        String token = jwtService.generateToken(user.getEmail(), user.getRole().name());
        long expiresAtMs = System.currentTimeMillis() + jwtService.getExpirationMs();

        return new LoginResponse(token, TOKEN_TYPE, expiresAtMs, user.getId(), buildFullName(user), user.getRole());
    }

    /**
     * Joins the name parts of a user into a single display name.
     *
     * @param user user whose name is needed
     * @return full name without extra blank spaces
     */
    private String buildFullName(User user) {
        StringBuilder fullName = new StringBuilder(user.getFirstName())
                .append(' ')
                .append(user.getFirstLastName());
        if (user.getSecondLastName() != null && !user.getSecondLastName().isBlank()) {
            fullName.append(' ').append(user.getSecondLastName());
        }
        return fullName.toString();
    }
}
