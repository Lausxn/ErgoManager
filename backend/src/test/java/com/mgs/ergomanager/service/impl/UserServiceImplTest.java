package com.mgs.ergomanager.service.impl;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.mgs.ergomanager.dto.user.UserRequestDTO;
import com.mgs.ergomanager.dto.user.UserResponseDTO;
import com.mgs.ergomanager.exception.DuplicateResourceException;
import com.mgs.ergomanager.model.User;
import com.mgs.ergomanager.model.enums.Role;
import com.mgs.ergomanager.repository.UserRepository;
import com.mgs.ergomanager.service.EmailService;
import java.time.LocalDateTime;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

/**
 * Unit tests for {@link UserServiceImpl}.
 */
@ExtendWith(MockitoExtension.class)
class UserServiceImplTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private EmailService emailService;

    private UserServiceImpl userService;

    /**
     * Creates the service under test with mocked collaborators.
     */
    @BeforeEach
    void setUp() {
        userService = new UserServiceImpl(
                userRepository,
                passwordEncoder,
                emailService);
    }

    /**
     * Verifies that a valid user is created, the password is hashed and the
     * temporary credentials are sent by email.
     */
    @Test
    void createShouldSaveUserAndSendTemporaryCredentials() {

        UserRequestDTO request = new UserRequestDTO(
                "Carlos",
                "Perez",
                "Lopez",
                "CARLOS@example.com",
                "Temporary123",
                Role.ERGONOMIST);

        when(userRepository.existsByEmail("carlos@example.com"))
                .thenReturn(false);

        when(passwordEncoder.encode("Temporary123"))
                .thenReturn("hashed-password");

        when(userRepository.saveAndFlush(any(User.class)))
                .thenAnswer(invocation -> {
                    User user = invocation.getArgument(0);
                    user.setId(1L);
                    user.setCreatedAt(LocalDateTime.now());
                    return user;
                });

        UserResponseDTO response = userService.create(request);

        ArgumentCaptor<User> userCaptor =
                ArgumentCaptor.forClass(User.class);

        verify(userRepository).saveAndFlush(userCaptor.capture());

        User savedUser = userCaptor.getValue();

        assertEquals("Carlos", savedUser.getFirstName());
        assertEquals("Perez", savedUser.getFirstLastName());
        assertEquals("Lopez", savedUser.getSecondLastName());
        assertEquals("carlos@example.com", savedUser.getEmail());
        assertEquals("hashed-password", savedUser.getPassword());
        assertEquals(Role.ERGONOMIST, savedUser.getRole());
        assertTrue(savedUser.isActive());

        assertEquals(1L, response.id());
        assertEquals("Carlos", response.firstName());
        assertEquals("Perez", response.firstLastName());
        assertEquals("Lopez", response.secondLastName());
        assertEquals("carlos@example.com", response.email());
        assertEquals(Role.ERGONOMIST, response.role());
        assertTrue(response.active());

        verify(passwordEncoder).encode("Temporary123");

        verify(emailService).sendTemporaryCredentials(
                "carlos@example.com",
                "Temporary123");
    }

    /**
     * Verifies that names and email are normalized before storing the user.
     */
    @Test
    void createShouldNormalizeUserData() {

        UserRequestDTO request = new UserRequestDTO(
                "  Carlos  ",
                "  Perez  ",
                "  Lopez  ",
                "  CARLOS@EXAMPLE.COM  ",
                "Temporary123",
                Role.ADMIN);

        when(userRepository.existsByEmail("carlos@example.com"))
                .thenReturn(false);

        when(passwordEncoder.encode("Temporary123"))
                .thenReturn("hashed-password");

        when(userRepository.saveAndFlush(any(User.class)))
                .thenAnswer(invocation -> {
                    User user = invocation.getArgument(0);
                    user.setId(2L);
                    user.setCreatedAt(LocalDateTime.now());
                    return user;
                });

        userService.create(request);

        ArgumentCaptor<User> userCaptor =
                ArgumentCaptor.forClass(User.class);

        verify(userRepository).saveAndFlush(userCaptor.capture());

        User savedUser = userCaptor.getValue();

        assertEquals("Carlos", savedUser.getFirstName());
        assertEquals("Perez", savedUser.getFirstLastName());
        assertEquals("Lopez", savedUser.getSecondLastName());
        assertEquals("carlos@example.com", savedUser.getEmail());
    }

    /**
     * Verifies that the optional second surname is stored as null when it is
     * blank.
     */
    @Test
    void createShouldStoreNullWhenSecondLastNameIsBlank() {

        UserRequestDTO request = new UserRequestDTO(
                "Carlos",
                "Perez",
                "   ",
                "carlos@example.com",
                "Temporary123",
                Role.ERGONOMIST);

        when(userRepository.existsByEmail("carlos@example.com"))
                .thenReturn(false);

        when(passwordEncoder.encode("Temporary123"))
                .thenReturn("hashed-password");

        when(userRepository.saveAndFlush(any(User.class)))
                .thenAnswer(invocation -> {
                    User user = invocation.getArgument(0);
                    user.setId(3L);
                    user.setCreatedAt(LocalDateTime.now());
                    return user;
                });

        userService.create(request);

        ArgumentCaptor<User> userCaptor =
                ArgumentCaptor.forClass(User.class);

        verify(userRepository).saveAndFlush(userCaptor.capture());

        User savedUser = userCaptor.getValue();

        assertNull(savedUser.getSecondLastName());
    }

    /**
     * Verifies that an already registered email is rejected before attempting
     * to save the user.
     */
    @Test
    void createShouldRejectDuplicatedEmail() {

        UserRequestDTO request = new UserRequestDTO(
                "Carlos",
                "Perez",
                "Lopez",
                "carlos@example.com",
                "Temporary123",
                Role.ERGONOMIST);

        when(userRepository.existsByEmail("carlos@example.com"))
                .thenReturn(true);

        assertThrows(
                DuplicateResourceException.class,
                () -> userService.create(request));

        verify(userRepository, never()).saveAndFlush(any(User.class));
        verify(passwordEncoder, never()).encode(any());
        verify(emailService, never())
                .sendTemporaryCredentials(any(), any());
    }
}