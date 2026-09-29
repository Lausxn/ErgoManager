package com.mgs.ergomanager.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.mgs.ergomanager.model.User;
import com.mgs.ergomanager.model.enums.Role;
import com.mgs.ergomanager.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

/** Unit tests for {@link DevAdminSeeder}. */
@ExtendWith(MockitoExtension.class)
class DevAdminSeederTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Test
    void createsAdministratorWhenThereAreNoUsers() {
        when(userRepository.count()).thenReturn(0L);
        when(passwordEncoder.encode("Admin123!")).thenReturn("hash");

        new DevAdminSeeder(userRepository, passwordEncoder, " Admin@ErgoManager.local ", "Admin123!").run(null);

        ArgumentCaptor<User> captor = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(captor.capture());
        User admin = captor.getValue();
        assertThat(admin.getEmail()).isEqualTo("admin@ergomanager.local");
        assertThat(admin.getPassword()).isEqualTo("hash");
        assertThat(admin.getRole()).isEqualTo(Role.ADMIN);
        assertThat(admin.getFirstName()).isEqualTo("Administrador");
        assertThat(admin.getFirstLastName()).isEqualTo("MGS");
        assertThat(admin.isActive()).isTrue();
    }

    @Test
    void doesNothingWhenUsersExist() {
        when(userRepository.count()).thenReturn(3L);

        new DevAdminSeeder(userRepository, passwordEncoder, "admin@ergomanager.local", "Admin123!").run(null);

        verify(userRepository, never()).save(any());
    }
}
