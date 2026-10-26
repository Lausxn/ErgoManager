package com.mgs.ergomanager.config;

import com.mgs.ergomanager.dto.user.UserRequestDTO;
import com.mgs.ergomanager.model.User;
import com.mgs.ergomanager.model.enums.Role;
import com.mgs.ergomanager.repository.UserRepository;
import com.mgs.ergomanager.security.PasswordRules;
import jakarta.validation.Validator;
import java.util.Locale;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.env.Environment;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;

/**
 * Creates one initial account of a role from the environment, so the system can
 * be signed in to the first time. No credential is stored in the code, and an
 * existing account is never overwritten or reactivated.
 */
abstract class BootstrapAccountInitializer implements ApplicationRunner {

    private static final Logger LOGGER = LoggerFactory.getLogger(BootstrapAccountInitializer.class);
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final Environment environment;
    private final Validator validator;
    private final Role role;
    private final String propertyPrefix;
    private final String accountName;

    /**
     * Builds the initializer of one role.
     *
     * @param userRepository  repository of application users
     * @param passwordEncoder configured BCrypt encoder
     * @param environment     external account configuration
     * @param validator       validator of the user request constraints
     * @param role            role of the account to create
     * @param propertyPrefix  prefix of the account properties, ending with a dot
     * @param accountName     name of the account in logs and errors, such as "administrator"
     */
    BootstrapAccountInitializer(UserRepository userRepository, PasswordEncoder passwordEncoder, Environment environment,
                                Validator validator, Role role, String propertyPrefix, String accountName) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.environment = environment;
        this.validator = validator;
        this.role = role;
        this.propertyPrefix = propertyPrefix;
        this.accountName = accountName;
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
            if (existing.getRole() != role) {
                throw new IllegalStateException("Bootstrap email belongs to a different role; account unchanged");
            }
            LOGGER.info("Initial {} {} already exists; account unchanged", accountName, request.email());
            return;
        }
        User user = new User();
        user.setFirstName(request.firstName());
        user.setFirstLastName(request.firstLastName());
        user.setSecondLastName(request.secondLastName());
        user.setEmail(request.email());
        user.setPassword(passwordEncoder.encode(request.password()));
        user.setRole(role);
        user.setActive(true);
        userRepository.save(user);
        LOGGER.info("Initial {} {} created", accountName, request.email());
    }

    /**
     * Reuses the user DTO rules and enforces the byte limit of BCrypt.
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
                environment.getProperty(propertyPrefix + "password"), role);
        if (!validator.validate(request).isEmpty()) {
            throw new IllegalStateException(
                    "Invalid " + accountName + " bootstrap configuration; check required account fields");
        }
        if (PasswordRules.exceedsMaxBytes(request.password())) {
            throw new IllegalStateException("Bootstrap " + accountName + " password must not exceed "
                    + PasswordRules.MAX_BYTES + " UTF-8 bytes");
        }
        return request;
    }

    /**
     * Trims a profile value before validation and lookup, keeping a missing one
     * missing. Passwords must not pass through this helper.
     *
     * @param name property name relative to the prefix
     * @return trimmed value, or null when not configured
     */
    private String readTrimmedProperty(String name) {
        String value = environment.getProperty(propertyPrefix + name);
        return value == null ? null : value.trim();
    }
}
