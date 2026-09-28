package com.mgs.ergomanager.config;

import com.mgs.ergomanager.dto.user.UserRequestDTO;
import com.mgs.ergomanager.model.User;
import com.mgs.ergomanager.model.enums.Role;
import com.mgs.ergomanager.repository.UserRepository;
import jakarta.validation.Validator;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.env.Environment;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Creates the initial ergonomist only when explicitly enabled by configuration.
 * Existing accounts are never overwritten or reactivated.
 */
@Component
@ConditionalOnProperty(name = "ergomanager.bootstrap.ergonomist.enabled", havingValue = "true")
public class ErgonomistInitializer implements ApplicationRunner {

    private static final String PROPERTY_PREFIX = "ergomanager.bootstrap.ergonomist.";

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final Environment environment;
    private final Validator validator;

    /**
     * Builds the initializer with the existing persistence and security components.
     *
     * @param userRepository repository of application users
     * @param passwordEncoder configured BCrypt encoder
     * @param environment external account configuration
     * @param validator validator for the existing user request constraints
     */
    public ErgonomistInitializer(UserRepository userRepository, PasswordEncoder passwordEncoder,
                                Environment environment, Validator validator) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.environment = environment;
        this.validator = validator;
    }

    /**
     * Inserts the configured account once. Invalid configuration aborts startup
     * without logging credentials or changing an existing account.
     *
     * @param arguments application startup arguments
     */
    @Override
    @Transactional
    public void run(ApplicationArguments arguments) {
        UserRequestDTO request = readRequest();
        User existing = userRepository.findByEmail(request.email()).orElse(null);
        if (existing != null) {
            if (existing.getRole() != Role.ERGONOMIST) {
                throw new IllegalStateException("Bootstrap email belongs to a different role; account unchanged");
            }
            return;
        }
        User user = new User();
        user.setFirstName(request.firstName());
        user.setFirstLastName(request.firstLastName());
        user.setSecondLastName(request.secondLastName());
        user.setEmail(request.email());
        user.setPassword(passwordEncoder.encode(request.password()));
        user.setRole(Role.ERGONOMIST);
        user.setActive(true);
        userRepository.save(user);
    }

    /**
     * Reuses the user DTO rules and enforces BCrypt's UTF-8 byte limit.
     *
     * @return validated configuration without default credentials
     */
    private UserRequestDTO readRequest() {
        String email = readTrimmedProperty("email");
        String secondLastName = readTrimmedProperty("second-last-name");
        UserRequestDTO request = new UserRequestDTO(
                readTrimmedProperty("first-name"),
                readTrimmedProperty("first-last-name"),
                secondLastName == null || secondLastName.isBlank() ? null : secondLastName,
                email == null ? null : email.toLowerCase(Locale.ROOT),
                environment.getProperty(PROPERTY_PREFIX + "password"), Role.ERGONOMIST);
        if (!validator.validate(request).isEmpty()) {
            throw new IllegalStateException(
                    "Invalid ergonomist bootstrap configuration; check required account fields");
        }
        if (request.password().getBytes(StandardCharsets.UTF_8).length > 72) {
            throw new IllegalStateException("Ergonomist bootstrap password must not exceed 72 UTF-8 bytes");
        }
        return request;
    }

    /**
     * Trims profile values before validation and lookup, preserving missing values.
     * Passwords must not pass through this helper.
     *
     * @param name property name relative to the bootstrap prefix
     * @return trimmed value, or null when not configured
     */
    private String readTrimmedProperty(String name) {
        String value = environment.getProperty(PROPERTY_PREFIX + name);
        return value == null ? null : value.trim();
    }
}
