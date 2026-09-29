package com.mgs.ergomanager.service.impl;

import com.mgs.ergomanager.dto.user.UserRequestDTO;
import com.mgs.ergomanager.dto.user.UserResponseDTO;
import com.mgs.ergomanager.dto.user.UserUpdateRequestDTO;
import com.mgs.ergomanager.event.UserCreatedEvent;
import com.mgs.ergomanager.exception.BusinessException;
import com.mgs.ergomanager.exception.DuplicateResourceException;
import com.mgs.ergomanager.exception.ResourceNotFoundException;
import com.mgs.ergomanager.model.User;
import com.mgs.ergomanager.model.enums.Role;
import com.mgs.ergomanager.repository.UserRepository;
import com.mgs.ergomanager.service.UserService;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Locale;
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

    private static final String ONLY_ADMIN_ROLE_MESSAGE = "No se puede cambiar el rol del único administrador activo.";

    private static final String ONLY_ADMIN_DEACTIVATION_MESSAGE = "No se puede desactivar al único administrador activo.";

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
            throw new DuplicateResourceException(DUPLICATE_EMAIL_MESSAGE);
        }

        if (request.password().getBytes(StandardCharsets.UTF_8).length > BCRYPT_MAX_BYTES) {
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
            throw new DuplicateResourceException(DUPLICATE_EMAIL_MESSAGE);
        }
    }

    /**
     * Updates the data and the role of an administrator or ergonomist. Changing
     * the role revokes the sessions of the user, and the only active
     * administrator cannot lose that role.
     *
     * @param id      identifier of the user
     * @param request new data of the user
     * @return updated user without exposing the password
     */
    @Override
    @Transactional
    public UserResponseDTO update(Long id, UserUpdateRequestDTO request) {

        User user = userRepository.findByIdForUpdate(id)
                .orElseThrow(() -> new ResourceNotFoundException(USER_NOT_FOUND_MESSAGE));

        String normalizedEmail = request.email()
                .trim()
                .toLowerCase(Locale.ROOT);

        userRepository.findByEmail(normalizedEmail)
                .filter(existingUser -> !existingUser.getId().equals(id))
                .ifPresent(existingUser -> {
                    throw new DuplicateResourceException(DUPLICATE_EMAIL_MESSAGE);
                });

        boolean changingOnlyActiveAdminRole =
                user.getRole() == Role.ADMIN
                        && request.role() == Role.ERGONOMIST
                        && user.isActive()
                        && userRepository.countByRoleAndActiveTrue(Role.ADMIN) == 1;

        if (changingOnlyActiveAdminRole) {
            throw new BusinessException(ONLY_ADMIN_ROLE_MESSAGE);
        }

        user.setFirstName(request.firstName());
        user.setFirstLastName(request.firstLastName());
        user.setSecondLastName(request.secondLastName());
        user.setEmail(normalizedEmail);
        if (user.getRole() != request.role()) {
            user.setTokenVersion(user.getTokenVersion() + 1);
            user.setRole(request.role());
        }

        try {
            User updatedUser = userRepository.saveAndFlush(user);
            return toResponse(updatedUser);
        } catch (DataIntegrityViolationException exception) {
            throw new DuplicateResourceException(DUPLICATE_EMAIL_MESSAGE);
        }
    }

    /**
     * Soft deletes the user: the row is kept so its records stay linked, the
     * account can no longer sign in and its open sessions are revoked.
     * Deactivating an inactive user changes nothing.
     */
    @Override
    @Transactional
    public void deactivate(Long id, String currentUserEmail) {
        User user = userRepository.findByIdForUpdate(id)
                .orElseThrow(() -> new ResourceNotFoundException(USER_NOT_FOUND_MESSAGE));

        if (user.getEmail().equalsIgnoreCase(currentUserEmail)) {
            throw new BusinessException("No puede desactivar su propia cuenta.");
        }
        if (!user.isActive()) {
            return;
        }
        if (user.getRole() == Role.ADMIN
                && userRepository.countByRoleAndActiveTrue(Role.ADMIN) == 1) {
            throw new BusinessException(ONLY_ADMIN_DEACTIVATION_MESSAGE);
        }

        user.setActive(false);
        // A new version rejects the tokens issued before, even after a reactivation.
        user.setTokenVersion(user.getTokenVersion() + 1);
        userRepository.saveAndFlush(user);
    }

    /**
     * Gives back the access to a deactivated user. The sessions revoked by the
     * deactivation stay revoked, so the user has to sign in again.
     *
     * @param id identifier of the user
     * @return the activated user
     */
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
