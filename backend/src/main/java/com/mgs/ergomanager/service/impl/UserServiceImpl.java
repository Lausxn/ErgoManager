package com.mgs.ergomanager.service.impl;

import com.mgs.ergomanager.dto.user.UserRequestDTO;
import com.mgs.ergomanager.dto.user.UserResponseDTO;
import com.mgs.ergomanager.dto.user.UserUpdateRequestDTO;
import com.mgs.ergomanager.exception.BusinessException;
import com.mgs.ergomanager.exception.DuplicateResourceException;
import com.mgs.ergomanager.exception.ResourceNotFoundException;
import com.mgs.ergomanager.model.User;
import com.mgs.ergomanager.model.enums.Role;
import com.mgs.ergomanager.repository.UserRepository;
import com.mgs.ergomanager.service.UserService;
import java.util.List;
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

    /**
     * Builds the service with its collaborators.
     *
     * @param userRepository  repository of application users
     * @param passwordEncoder encoder used to hash the passwords
     */
    public UserServiceImpl(UserRepository userRepository,
                           PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
@Transactional(readOnly = true)
public List<UserResponseDTO> findAll() {
    return userRepository.findAll()
            .stream()
            .map(this::toResponse)
            .toList();
}

   @Override
@Transactional(readOnly = true)
public UserResponseDTO findById(Long id) {
    User user = userRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("User", id));

    return toResponse(user);
}

    @Override
    public UserResponseDTO create(UserRequestDTO request) {
        // TODO: reject a duplicated email and hash the password before saving.
        throw new UnsupportedOperationException(
                "UserService.create is not implemented yet");
    }

    @Override
    @Transactional
    public UserResponseDTO update(Long id, UserUpdateRequestDTO request) {

        User user = userRepository.findByIdForUpdate(id)
                .orElseThrow(() -> new ResourceNotFoundException("User", id));

        String normalizedEmail = request.email()
                .trim()
                .toLowerCase();

        userRepository.findByEmail(normalizedEmail)
                .filter(existingUser -> !existingUser.getId().equals(id))
                .ifPresent(existingUser -> {
                    throw new DuplicateResourceException(
                            "Email is already registered: " + normalizedEmail);
                });

        boolean changingOnlyActiveAdminRole =
                user.getRole() == Role.ADMIN
                        && request.role() == Role.ERGONOMIST
                        && user.isActive()
                        && userRepository.countByRoleAndActiveTrue(Role.ADMIN) == 1;

        if (changingOnlyActiveAdminRole) {
            throw new BusinessException(
                    "Cannot change the role of the only active administrator");
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
            throw new DuplicateResourceException(
                    "Email is already registered: " + normalizedEmail);
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
                .orElseThrow(() -> new ResourceNotFoundException("User", id));

        if (user.getEmail().equalsIgnoreCase(currentUserEmail)) {
            throw new BusinessException("No puede desactivar su propia cuenta.");
        }
        if (!user.isActive()) {
            return;
        }
        if (user.getRole() == Role.ADMIN
                && userRepository.countByRoleAndActiveTrue(Role.ADMIN) == 1) {
            throw new BusinessException("No se puede desactivar al único administrador activo.");
        }

        user.setActive(false);
        // A new version rejects the tokens issued before, even after a reactivation.
        user.setTokenVersion(user.getTokenVersion() + 1);
        userRepository.saveAndFlush(user);
    }

    /**
     * Maps a user entity to its response DTO.
     *
     * @param user user entity to map
     * @return response DTO
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
