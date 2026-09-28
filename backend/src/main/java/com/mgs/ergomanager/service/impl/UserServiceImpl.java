package com.mgs.ergomanager.service.impl;

import com.mgs.ergomanager.dto.user.UserRequestDTO;
import com.mgs.ergomanager.dto.user.UserResponseDTO;
import com.mgs.ergomanager.event.UserCreatedEvent;
import com.mgs.ergomanager.exception.DuplicateResourceException;
import com.mgs.ergomanager.model.User;
import com.mgs.ergomanager.repository.UserRepository;
import com.mgs.ergomanager.service.UserService;
import java.util.List;
import java.util.Locale;
import java.nio.charset.StandardCharsets;
import com.mgs.ergomanager.exception.BusinessException;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Default implementation of {@link UserService}.
 */
@Service
public class UserServiceImpl implements UserService {

    private final UserRepository userRepository;

    private final PasswordEncoder passwordEncoder;

    private final ApplicationEventPublisher eventPublisher;

    /**
     * Builds the service with its collaborators.
     *
     * @param userRepository  repository of application users
     * @param passwordEncoder encoder used to hash the passwords
     * @param eventPublisher  publisher used to notify that a user was created
     */
    public UserServiceImpl(
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            ApplicationEventPublisher eventPublisher) {

        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.eventPublisher = eventPublisher;
    }

    @Override
    public List<UserResponseDTO> findAll() {
        // TODO: read every user and map it to UserResponseDTO.
        throw new UnsupportedOperationException(
                "UserService.findAll is not implemented yet");
    }

    @Override
    public UserResponseDTO findById(Long id) {
        // TODO: read the user or raise ResourceNotFoundException.
        throw new UnsupportedOperationException(
                "UserService.findById is not implemented yet");
    }

    /**
     * Creates a new administrator or ergonomist.
     *
     * <p>The supplied password is treated as the temporary password. It is
     * hashed before being persisted and the original value is delivered by
     * email after the database transaction commits successfully.</p>
     *
     * @param request data required to create the user
     * @return created user without exposing the password
     */
    @Override
    @Transactional
    public UserResponseDTO create(UserRequestDTO request) {

        String normalizedEmail = request.email()
                .trim()
                .toLowerCase(Locale.ROOT);

        if (userRepository.existsByEmail(normalizedEmail)) {
            throw new DuplicateResourceException(
                    "El correo ya está registrado");
        }

        if (request.password().getBytes(StandardCharsets.UTF_8).length > 72) {
            throw new BusinessException("La contraseña no puede superar 72 bytes UTF-8.");
        }

        User user = new User();

        user.setFirstName(request.firstName().trim());
        user.setFirstLastName(request.firstLastName().trim());

        if (request.secondLastName() != null
                && !request.secondLastName().isBlank()) {
            user.setSecondLastName(
                    request.secondLastName().trim());
        } else {
            user.setSecondLastName(null);
        }

        user.setEmail(normalizedEmail);
        user.setPassword(
                passwordEncoder.encode(
                        request.password()));
        user.setRole(request.role());
        user.setActive(true);

        try {
            User createdUser =
                    userRepository.saveAndFlush(user);

            eventPublisher.publishEvent(
                    new UserCreatedEvent(
                            normalizedEmail,
                            request.password()));

            return toResponse(createdUser);

        } catch (DataIntegrityViolationException exception) {
            throw new DuplicateResourceException(
                    "El correo ya está registrado");
        }
    }

    @Override
    public UserResponseDTO update(
            Long id,
            UserRequestDTO request) {

        // TODO: copy the request over the stored user, rehashing the password.
        throw new UnsupportedOperationException(
                "UserService.update is not implemented yet");
    }

    @Override
    public void deactivate(Long id) {
        // TODO: set the active flag to false, never delete the row.
        throw new UnsupportedOperationException(
                "UserService.deactivate is not implemented yet");
    }

    /**
     * Maps a user entity to the representation exposed by the API.
     *
     * @param user stored user
     * @return user response without the password
     */
    private UserResponseDTO toResponse(User user) {
        return new UserResponseDTO(
                user.getId(),
                user.getFirstName(),
                user.getFirstLastName(),
                user.getSecondLastName(),
                user.getEmail(),
                user.getRole(),
                user.isActive(),
                user.getCreatedAt());
    }
}
