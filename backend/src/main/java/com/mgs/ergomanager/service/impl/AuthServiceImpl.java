package com.mgs.ergomanager.service.impl;

import com.mgs.ergomanager.dto.auth.ChangePasswordRequestDTO;
import com.mgs.ergomanager.dto.auth.LoginRequestDTO;
import com.mgs.ergomanager.dto.auth.LoginResponseDTO;
import com.mgs.ergomanager.exception.BusinessException;
import com.mgs.ergomanager.exception.ResourceNotFoundException;
import com.mgs.ergomanager.model.User;
import com.mgs.ergomanager.repository.UserRepository;
import com.mgs.ergomanager.security.JwtService;
import com.mgs.ergomanager.service.AuthService;
import java.nio.charset.StandardCharsets;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
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

    private final PasswordEncoder passwordEncoder;

    /**
     * Builds the service with its collaborators.
     *
     * @param authenticationManager manager that validates the credentials
     * @param userRepository        repository of application users
     * @param jwtService            service that issues the tokens
     * @param passwordEncoder       existing encoder used to check and hash passwords
     */
    public AuthServiceImpl(AuthenticationManager authenticationManager,
                           UserRepository userRepository,
                           JwtService jwtService,
                           PasswordEncoder passwordEncoder) {
        this.authenticationManager = authenticationManager;
        this.userRepository = userRepository;
        this.jwtService = jwtService;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    @Transactional(readOnly = true)
    public LoginResponseDTO login(LoginRequestDTO request) {
        authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.email(), request.password()));

        User user = userRepository.findByEmail(request.email())
                .orElseThrow(() -> new ResourceNotFoundException("User", request.email()));

        return buildSession(user);
    }

    @Override
    @Transactional
    public LoginResponseDTO changePassword(String email, ChangePasswordRequestDTO request) {
        User user = userRepository.findByEmailForUpdate(email)
                .orElseThrow(() -> new ResourceNotFoundException("User", email));
        if (!user.isActive()) {
            throw new BusinessException("User is inactive");
        }
        if (request.currentPassword().getBytes(StandardCharsets.UTF_8).length > 72
                || !passwordEncoder.matches(request.currentPassword(), user.getPassword())) {
            throw new BusinessException("Current password is incorrect");
        }
        if (request.newPassword().getBytes(StandardCharsets.UTF_8).length > 72) {
            throw new BusinessException("New password must not exceed 72 UTF-8 bytes");
        }
        if (passwordEncoder.matches(request.newPassword(), user.getPassword())) {
            throw new BusinessException("New password must differ from the current password");
        }
        user.setPassword(passwordEncoder.encode(request.newPassword()));
        user.setTokenVersion(user.getTokenVersion() + 1);
        userRepository.save(user);
        return buildSession(user);
    }

    /**
     * Builds the shared login and password change response.
     *
     * @param user authenticated user with their current session version
     * @return token and profile of the user
     */
    private LoginResponseDTO buildSession(User user) {
        String token = jwtService.generateToken(user.getEmail(), user.getRole().name(), user.getTokenVersion());
        long expiresAtMs = System.currentTimeMillis() + jwtService.getExpirationMs();

        return new LoginResponseDTO(token, TOKEN_TYPE, expiresAtMs, user.getId(), buildFullName(user), user.getRole());
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
