package com.mgs.ergomanager.config;

import com.mgs.ergomanager.model.enums.Role;
import com.mgs.ergomanager.repository.UserRepository;
import jakarta.validation.Validator;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.env.Environment;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

/**
 * Creates the initial ergonomist when explicitly enabled by configuration.
 */
@Component
@ConditionalOnProperty(name = "ergomanager.bootstrap.ergonomist.enabled", havingValue = "true")
public class ErgonomistInitializer extends BootstrapAccountInitializer {

    /**
     * Builds the initializer with the existing persistence and security components.
     *
     * @param userRepository  repository of application users
     * @param passwordEncoder configured BCrypt encoder
     * @param environment     external account configuration
     * @param validator       validator of the user request constraints
     */
    public ErgonomistInitializer(UserRepository userRepository, PasswordEncoder passwordEncoder,
                                 Environment environment, Validator validator) {
        super(userRepository, passwordEncoder, environment, validator,
                Role.ERGONOMIST, "ergomanager.bootstrap.ergonomist.", "ergonomist");
    }
}
