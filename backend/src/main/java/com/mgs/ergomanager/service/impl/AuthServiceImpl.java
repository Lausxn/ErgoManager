package com.mgs.ergomanager.service.impl;

import com.mgs.ergomanager.dto.auth.ChangePasswordRequestDTO;
import com.mgs.ergomanager.dto.auth.LoginRequestDTO;
import com.mgs.ergomanager.dto.auth.LoginResponseDTO;
import com.mgs.ergomanager.exception.BusinessException;
import com.mgs.ergomanager.exception.ResourceNotFoundException;
import com.mgs.ergomanager.model.User;
import com.mgs.ergomanager.repository.UserRepository;
import com.mgs.ergomanager.security.JwtService;
import com.mgs.ergomanager.security.PasswordRules;
import com.mgs.ergomanager.service.AuthService;
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
    private static final String USER_NOT_FOUND_MESSAGE = "No se encontró el usuario.";
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
                .orElseThrow(() -> new ResourceNotFoundException(USER_NOT_FOUND_MESSAGE));

        return buildSession(user);
    }

    @Override
    @Transactional
    public LoginResponseDTO changePassword(String email, ChangePasswordRequestDTO request) {
        User user = userRepository.findByEmailForUpdate(email)
                .orElseThrow(() -> new ResourceNotFoundException(USER_NOT_FOUND_MESSAGE));
        if (!user.isActive()) {
            throw new BusinessException("La cuenta está desactivada. Contacte al administrador.");
        }
        if (PasswordRules.exceedsMaxBytes(request.currentPassword())
                || !passwordEncoder.matches(request.currentPassword(), user.getPassword())) {
            throw new BusinessException("La contraseña actual es incorrecta.");
        }
        if (PasswordRules.exceedsMaxBytes(request.newPassword())) {
            throw new BusinessException("La nueva contraseña es demasiado larga. Use menos caracteres con tilde o ñ.");
        }
        if (passwordEncoder.matches(request.newPassword(), user.getPassword())) {
            throw new BusinessException("La nueva contraseña debe ser diferente a la actual.");
        }
        user.setPassword(passwordEncoder.encode(request.newPassword()));
        user.setMustChangePassword(false);
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
        return new LoginResponseDTO(token, TOKEN_TYPE, expiresAtMs, user.getId(), user.getFullName(), user.getRole(),
                user.isMustChangePassword());
    }
}
