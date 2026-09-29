package com.mgs.ergomanager.config;

import com.mgs.ergomanager.model.User;
import com.mgs.ergomanager.model.enums.Role;
import com.mgs.ergomanager.repository.UserRepository;
import java.util.Locale;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Creates the first administrator on a fresh development database, so the
 * application can be used right after the first start. It only runs with the
 * "dev" profile and only when the users table is empty.
 */
@Component
@Profile("dev")
public class DevAdminSeeder implements ApplicationRunner {

    private static final Logger LOGGER = LoggerFactory.getLogger(DevAdminSeeder.class);

    private final UserRepository userRepository;

    private final PasswordEncoder passwordEncoder;

    private final String adminEmail;

    private final String adminPassword;

    /**
     * Builds the seeder with its collaborators and the configured credentials.
     *
     * @param userRepository  repository of application users
     * @param passwordEncoder encoder used to hash the password
     * @param adminEmail      email of the initial administrator
     * @param adminPassword   password of the initial administrator
     */
    public DevAdminSeeder(UserRepository userRepository,
                          PasswordEncoder passwordEncoder,
                          @Value("${ergomanager.seed.admin-email}") String adminEmail,
                          @Value("${ergomanager.seed.admin-password}") String adminPassword) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.adminEmail = adminEmail.trim().toLowerCase(Locale.ROOT);
        this.adminPassword = adminPassword;
    }

    /**
     * Creates the administrator when there is no user yet.
     *
     * @param args application arguments, not used
     */
    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (userRepository.count() > 0) {
            return;
        }
        User admin = new User();
        admin.setFirstName("Administrador");
        admin.setFirstLastName("MGS");
        admin.setEmail(adminEmail);
        admin.setPassword(passwordEncoder.encode(adminPassword));
        admin.setRole(Role.ADMIN);
        admin.setActive(true);
        userRepository.save(admin);
        LOGGER.info("Se creó el administrador inicial {} porque la tabla de usuarios estaba vacía.", adminEmail);
    }
}
