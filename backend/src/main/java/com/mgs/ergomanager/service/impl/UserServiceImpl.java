package com.mgs.ergomanager.service.impl;

import com.mgs.ergomanager.dto.user.UserRequestDTO;
import com.mgs.ergomanager.dto.user.UserResponseDTO;
import com.mgs.ergomanager.dto.user.UserUpdateRequestDTO;
import com.mgs.ergomanager.event.UserCreatedEvent;
import com.mgs.ergomanager.exception.DuplicateResourceException;
import com.mgs.ergomanager.exception.ResourceNotFoundException;
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

    private static final String USER_NOT_FOUND_MESSAGE = "No se encontró el usuario.";

    private static final String DUPLICATE_EMAIL_MESSAGE = "El correo ya está registrado";

    private static final int BCRYPT_MAX_BYTES = 72;

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
    @Transactional(readOnly = true)
    public List<UserResponseDTO> findAll() {
        return userRepository.findAllByOrderByCreatedAtDescIdDesc().stream()
                .map(this::toResponse)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public UserResponseDTO findById(Long id) {
        return toResponse(getUser(id));
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

    /**
     * Updates an administrator or ergonomist. The password is only replaced
     * when the request carries one; in that case the sessions of the user are
     * revoked. An administrator cannot change their own role.
     *
     * @param id         identifier of the user
     * @param request    new data of the user
     * @param actorEmail email of the administrator performing the change
     * @return updated user without exposing the password
     */
    @Override
    @Transactional
    public UserResponseDTO update(Long id, UserUpdateRequestDTO request, String actorEmail) {
        User user = getUser(id);

        if (isSameAccount(user, actorEmail) && user.getRole() != request.role()) {
            throw new BusinessException("No puede cambiar su propio rol.");
        }
        if (userRepository.existsByEmailAndIdNot(request.email(), id)) {
            throw new DuplicateResourceException(DUPLICATE_EMAIL_MESSAGE);
        }
        if (request.password() != null
                && request.password().getBytes(StandardCharsets.UTF_8).length > BCRYPT_MAX_BYTES) {
            throw new BusinessException("La contraseña no puede superar 72 bytes UTF-8.");
        }

        user.setFirstName(request.firstName());
        user.setFirstLastName(request.firstLastName());
        user.setSecondLastName(request.secondLastName());
        user.setEmail(request.email());
        user.setRole(request.role());
        if (request.password() != null) {
            user.setPassword(passwordEncoder.encode(request.password()));
            user.setTokenVersion(user.getTokenVersion() + 1);
        }

        try {
            return toResponse(userRepository.saveAndFlush(user));
        } catch (DataIntegrityViolationException exception) {
            throw new DuplicateResourceException(DUPLICATE_EMAIL_MESSAGE);
        }
    }

    /**
     * Deactivates a user without deleting the row and revokes their sessions.
     *
     * @param id         identifier of the user
     * @param actorEmail email of the administrator performing the change
     */
    @Override
    @Transactional
    public void deactivate(Long id, String actorEmail) {
        User user = getUser(id);
        if (isSameAccount(user, actorEmail)) {
            throw new BusinessException("No puede desactivar su propia cuenta.");
        }
        user.setActive(false);
        user.setTokenVersion(user.getTokenVersion() + 1);
        userRepository.save(user);
    }

    @Override
    @Transactional
    public UserResponseDTO activate(Long id) {
        User user = getUser(id);
        user.setActive(true);
        return toResponse(userRepository.save(user));
    }

    /**
     * Reads a user or fails with HTTP 404.
     *
     * @param id identifier of the user
     * @return the stored user
     */
    private User getUser(Long id) {
        return userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException(USER_NOT_FOUND_MESSAGE));
    }

    /**
     * Tells whether the target user is the administrator performing the change.
     *
     * @param user       target user
     * @param actorEmail email of the signed in administrator
     * @return true when both are the same account
     */
    private boolean isSameAccount(User user, String actorEmail) {
        return actorEmail != null && user.getEmail().equalsIgnoreCase(actorEmail.trim());
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
