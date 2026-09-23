package com.mgs.ergomanager.service.impl;

import com.mgs.ergomanager.dto.user.UserRequestDTO;
import com.mgs.ergomanager.dto.user.UserResponseDTO;
import com.mgs.ergomanager.repository.UserRepository;
import com.mgs.ergomanager.dto.user.UserUpdateRequestDTO;
import com.mgs.ergomanager.exception.DuplicateResourceException;
import com.mgs.ergomanager.exception.ResourceNotFoundException;
import com.mgs.ergomanager.model.User;
import com.mgs.ergomanager.service.UserService;
import java.util.List;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

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
    public UserServiceImpl(UserRepository userRepository, PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    public List<UserResponseDTO> findAll() {
        // TODO: read every user and map it to UserResponseDTO.
        throw new UnsupportedOperationException("UserService.findAll is not implemented yet");
    }

    @Override
    public UserResponseDTO findById(Long id) {
        // TODO: read the user or raise ResourceNotFoundException.
        throw new UnsupportedOperationException("UserService.findById is not implemented yet");
    }

    @Override
    public UserResponseDTO create(UserRequestDTO request) {
        // TODO: reject a duplicated email and hash the password before saving.
        throw new UnsupportedOperationException("UserService.create is not implemented yet");
    }

    @Override
    public UserResponseDTO update(Long id, UserUpdateRequestDTO request) {

        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("User", id));

        userRepository.findByEmail(request.email())
                .filter(existingUser -> !existingUser.getId().equals(id))
                .ifPresent(existingUser -> {
                    throw new DuplicateResourceException(
                            "Email is already registered: " + request.email());
                });

        user.setFirstName(request.firstName());
        user.setFirstLastName(request.firstLastName());
        user.setSecondLastName(request.secondLastName());
        user.setEmail(request.email());
        user.setRole(request.role());

        User updatedUser = userRepository.save(user);

        return new UserResponseDTO(
                updatedUser.getId(),
                updatedUser.getFirstName(),
                updatedUser.getFirstLastName(),
                updatedUser.getSecondLastName(),
                updatedUser.getEmail(),
                updatedUser.getRole(),
                updatedUser.isActive(),
                updatedUser.getCreatedAt());
    }

    @Override
    public void deactivate(Long id) {
        // TODO: set the active flag to false, never delete the row.
        throw new UnsupportedOperationException("UserService.deactivate is not implemented yet");
    }
}
