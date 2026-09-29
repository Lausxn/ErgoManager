package com.mgs.ergomanager;

import com.jayway.jsonpath.JsonPath;
import com.mgs.ergomanager.config.AdminInitializer;
import com.mgs.ergomanager.model.User;
import com.mgs.ergomanager.model.enums.Role;
import com.mgs.ergomanager.repository.UserRepository;
import jakarta.validation.Validator;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.DefaultApplicationArguments;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.env.MockEnvironment;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Verifies opt-in startup creation of the initial administrator, BCrypt persistence
 * and role permissions. Credentials here are synthetic test data used only with H2,
 * in a database of its own so other suites that clear the users do not affect it.
 */
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:admin_bootstrap_db;DB_CLOSE_DELAY=-1;MODE=MySQL",
        "ergomanager.bootstrap.admin.enabled=true",
        "ergomanager.bootstrap.admin.first-name=Test",
        "ergomanager.bootstrap.admin.first-last-name=Administrator",
        "ergomanager.bootstrap.admin.email=admin@example.test",
        "ergomanager.bootstrap.admin.password=AdminPassword1!"
})
@ActiveProfiles("test")
class AdminInitializerTests {

    private static final String PREFIX = "ergomanager.bootstrap.admin.";
    private static final String EMAIL = "admin@example.test";
    private static final String PASSWORD = "AdminPassword1!";

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private AdminInitializer initializer;

    @Autowired
    private Validator validator;

    @Autowired
    private WebApplicationContext context;

    @Test
    void startupCreatesActiveAdministratorWithPersistedHash() {
        User user = userRepository.findByEmail(EMAIL).orElseThrow();
        assertThat(user.getFirstName()).isEqualTo("Test");
        assertThat(user.getFirstLastName()).isEqualTo("Administrator");
        assertThat(user.getSecondLastName()).isNull();
        assertThat(user.getRole()).isEqualTo(Role.ADMIN);
        assertThat(user.isActive()).isTrue();
        assertThat(user.getPassword()).startsWith("$2").isNotEqualTo(PASSWORD);
        assertThat(passwordEncoder.matches(PASSWORD, user.getPassword())).isTrue();
    }

    @Test
    void repeatedStartupDoesNotDuplicateOrOverwriteUser() {
        User before = userRepository.findByEmail(EMAIL).orElseThrow();
        long count = userRepository.count();
        initializer.run(new DefaultApplicationArguments());
        User after = userRepository.findByEmail(EMAIL).orElseThrow();
        assertThat(userRepository.count()).isEqualTo(count);
        assertThat(after.getId()).isEqualTo(before.getId());
        assertThat(after.getPassword()).isEqualTo(before.getPassword());
    }

    @Test
    void deactivatedAdministratorIsNotReactivatedOrChanged() {
        User existing = createExisting(uniqueEmail(), Role.ADMIN);
        existing.setActive(false);
        userRepository.saveAndFlush(existing);
        runWith(configuration().withProperty(PREFIX + "email", existing.getEmail())
                .withProperty(PREFIX + "password", "OtherPassword2!"));
        User after = userRepository.findById(existing.getId()).orElseThrow();
        assertThat(after.isActive()).isFalse();
        assertThat(after.getFirstName()).isEqualTo("Existing");
        assertThat(after.getPassword()).isEqualTo(existing.getPassword());
    }

    @Test
    void rejectsEmailOwnedByErgonomistWithoutChangingIt() {
        User ergonomist = createExisting(uniqueEmail(), Role.ERGONOMIST);
        assertThatThrownBy(() -> runWith(configuration().withProperty(PREFIX + "email", ergonomist.getEmail())))
                .isInstanceOf(IllegalStateException.class).hasMessageContaining("different role");
        User after = userRepository.findById(ergonomist.getId()).orElseThrow();
        assertThat(after.getRole()).isEqualTo(Role.ERGONOMIST);
        assertThat(after.getPassword()).isEqualTo(ergonomist.getPassword());
    }

    @Test
    void normalizesConfiguredAccountData() {
        String email = uniqueEmail();
        runWith(configuration()
                .withProperty(PREFIX + "first-name", "  Juan  ")
                .withProperty(PREFIX + "first-last-name", "  Madrigal  ")
                .withProperty(PREFIX + "second-last-name", "   ")
                .withProperty(PREFIX + "email", "  " + email.toUpperCase() + "  "));
        User created = userRepository.findByEmail(email).orElseThrow();
        assertThat(created.getFirstName()).isEqualTo("Juan");
        assertThat(created.getFirstLastName()).isEqualTo("Madrigal");
        assertThat(created.getSecondLastName()).isNull();
        assertThat(created.getRole()).isEqualTo(Role.ADMIN);
    }

    @ParameterizedTest
    @ValueSource(strings = {"first-name", "first-last-name", "email", "password"})
    void rejectsMissingRequiredConfigurationWithoutWriting(String property) {
        long count = userRepository.count();
        assertThatThrownBy(() -> runWith(configuration().withProperty(PREFIX + property, "")))
                .isInstanceOf(IllegalStateException.class).hasMessageContaining("configuration");
        assertThat(userRepository.count()).isEqualTo(count);
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {"invalid", "   "})
    void rejectsInvalidEmailWithoutWriting(String email) {
        long count = userRepository.count();
        // A null email means the property is not configured at all.
        MockEnvironment environment = new MockEnvironment().withProperty(PREFIX + "first-name", "Test")
                .withProperty(PREFIX + "first-last-name", "Administrator")
                .withProperty(PREFIX + "password", PASSWORD);
        if (email != null) {
            environment.withProperty(PREFIX + "email", email);
        }
        assertThatThrownBy(() -> runWith(environment)).isInstanceOf(IllegalStateException.class);
        assertThat(userRepository.count()).isEqualTo(count);
    }

    @ParameterizedTest
    @ValueSource(strings = {"short", "ññññññññññññññññññññññññññññññññññññññññ"})
    void rejectsInvalidPasswordsWithoutLeakingThem(String password) {
        long count = userRepository.count();
        assertThatThrownBy(() -> runWith(configuration().withProperty(PREFIX + "password", password)))
                .isInstanceOf(IllegalStateException.class).hasMessageNotContaining(password);
        assertThat(userRepository.count()).isEqualTo(count);
    }

    @Test
    void initialAdministratorCanLoginAndAccessOnlyAdministratorPermissions() throws Exception {
        MockMvc mockMvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        String body = mockMvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + EMAIL + "\",\"password\":\"" + PASSWORD + "\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("role").value("ADMIN"))
                .andExpect(jsonPath("password").doesNotExist())
                .andReturn().getResponse().getContentAsString();
        String token = JsonPath.read(body, "$.token");
        // An empty user reaches DTO validation (400), not access denial (403).
        // The user service belongs to another task and is not executed here.
        mockMvc.perform(post("/api/users").header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isBadRequest());
        mockMvc.perform(post("/api/personalized-evaluations").header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isForbidden());
        mockMvc.perform(post("/api/users")
                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isUnauthorized());
    }

    private MockEnvironment configuration() {
        return new MockEnvironment().withProperty(PREFIX + "first-name", "Test")
                .withProperty(PREFIX + "first-last-name", "Administrator")
                .withProperty(PREFIX + "email", uniqueEmail())
                .withProperty(PREFIX + "password", PASSWORD);
    }

    private String uniqueEmail() {
        return "admin-" + UUID.randomUUID() + "@example.test";
    }

    private void runWith(MockEnvironment environment) {
        new AdminInitializer(userRepository, passwordEncoder, environment, validator)
                .run(new DefaultApplicationArguments());
    }

    private User createExisting(String email, Role role) {
        User user = new User();
        user.setFirstName("Existing");
        user.setFirstLastName("User");
        user.setEmail(email);
        user.setRole(role);
        user.setPassword(passwordEncoder.encode("ExistingPassword2!"));
        return userRepository.saveAndFlush(user);
    }
}
