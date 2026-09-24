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

    @Override
    public UserResponseDTO create(UserRequestDTO request) {
        // TODO: reject a duplicated email and hash the password before saving.
        throw new UnsupportedOperationException(
                "UserService.create is not implemented yet");
    }

    @Override
    @Transactional
    public UserResponseDTO update(Long id, UserUpdateRequestDTO request) {

        User user = userRepository.findById(id)
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
        user.setRole(request.role());

        try {
            User updatedUser = userRepository.saveAndFlush(user);
            return toResponse(updatedUser);
        } catch (DataIntegrityViolationException exception) {
            throw new DuplicateResourceException(
                    "Email is already registered: " + normalizedEmail);
        }
    }

    @Override
    public void deactivate(Long id) {
        // TODO: set the active flag to false, never delete the row.
        throw new UnsupportedOperationException(
                "UserService.deactivate is not implemented yet");
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