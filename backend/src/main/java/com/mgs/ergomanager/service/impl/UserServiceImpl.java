package com.mgs.ergomanager.service.impl;

import com.mgs.ergomanager.dto.user.UserRequestDTO;
import com.mgs.ergomanager.dto.user.UserResponseDTO;
import com.mgs.ergomanager.repository.UserRepository;
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
    public UserResponseDTO update(Long id, UserRequestDTO request) {
        // TODO: copy the request over the stored user, rehashing the password.
        throw new UnsupportedOperationException("UserService.update is not implemented yet");
    }

    @Override
    public void deactivate(Long id) {
        // TODO: set the active flag to false, never delete the row.
        throw new UnsupportedOperationException("UserService.deactivate is not implemented yet");
    }
}
