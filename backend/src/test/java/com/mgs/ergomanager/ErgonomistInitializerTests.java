package com.mgs.ergomanager;

import com.jayway.jsonpath.JsonPath;
import com.mgs.ergomanager.config.ErgonomistInitializer;
import com.mgs.ergomanager.model.User;
import com.mgs.ergomanager.model.enums.Role;
import com.mgs.ergomanager.repository.UserRepository;
import jakarta.validation.Validator;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Verifies opt-in startup creation, committed BCrypt persistence and role restrictions.
 * Credentials here are synthetic test data used only with H2.
 */
@SpringBootTest(properties = {
        "ergomanager.bootstrap.ergonomist.enabled=true",
        "ergomanager.bootstrap.ergonomist.first-name=Test",
        "ergomanager.bootstrap.ergonomist.first-last-name=Ergonomist",
        "ergomanager.bootstrap.ergonomist.email=ergonomist@example.test",
        "ergomanager.bootstrap.ergonomist.password=TestPassword1!"
})
@ActiveProfiles("test")
class ErgonomistInitializerTests {

    private static final String PREFIX = "ergomanager.bootstrap.ergonomist.";
    private static final String EMAIL = "ergonomist@example.test";
    private static final String PASSWORD = "TestPassword1!";

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private ErgonomistInitializer initializer;

    @Autowired
    private Validator validator;

    @Autowired
    private WebApplicationContext context;

    @Test
    void startupCreatesActiveErgonomistWithPersistedHash() {
        User user = userRepository.findByEmail(EMAIL).orElseThrow();
        assertThat(user.getFirstName()).isEqualTo("Test");
        assertThat(user.getFirstLastName()).isEqualTo("Ergonomist");
        assertThat(user.getRole()).isEqualTo(Role.ERGONOMIST);
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
    void existingDisabledAccountRetainsPasswordAndProfile() {
        User existing = createExisting("disabled@example.test", Role.ERGONOMIST);
        existing.setActive(false);
        userRepository.saveAndFlush(existing);
        runWith(configuration().withProperty(PREFIX + "email", existing.getEmail()));
        User after = userRepository.findById(existing.getId()).orElseThrow();
        assertThat(after.isActive()).isFalse();
        assertThat(after.getFirstName()).isEqualTo("Existing");
        assertThat(after.getPassword()).isEqualTo(existing.getPassword());
    }

    @Test
    void rejectsEmailOwnedByAdministratorWithoutChangingIt() {
        User admin = createExisting("admin@example.test", Role.ADMIN);
        assertThatThrownBy(() -> runWith(configuration().withProperty(PREFIX + "email", admin.getEmail())))
                .isInstanceOf(IllegalStateException.class).hasMessageContaining("different role");
        User after = userRepository.findById(admin.getId()).orElseThrow();
        assertThat(after.getRole()).isEqualTo(Role.ADMIN);
        assertThat(after.getPassword()).isEqualTo(admin.getPassword());
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
    @ValueSource(strings = {"short", "ññññññññññññññññññññññññññññññññññññññññ"})
    void rejectsInvalidPasswordsWithoutLeakingThem(String password) {
        long count = userRepository.count();
        assertThatThrownBy(() -> runWith(configuration().withProperty(PREFIX + "password", password)))
                .isInstanceOf(IllegalStateException.class).hasMessageNotContaining(password);
        assertThat(userRepository.count()).isEqualTo(count);
    }

    @Test
    void rejectsInvalidEmailWithoutWriting() {
        long count = userRepository.count();
        assertThatThrownBy(() -> runWith(configuration().withProperty(PREFIX + "email", "invalid")))
                .isInstanceOf(IllegalStateException.class);
        assertThat(userRepository.count()).isEqualTo(count);
    }

    @Test
    void initialUserCanLoginAndAccessOnlyExistingErgonomistPermissions() throws Exception {
        MockMvc mockMvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        String body = mockMvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + EMAIL + "\",\"password\":\"" + PASSWORD + "\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("role").value("ERGONOMIST"))
                .andExpect(jsonPath("password").doesNotExist())
                .andReturn().getResponse().getContentAsString();
        String token = JsonPath.read(body, "$.token");
        for (String path : new String[]{"/api/users", "/api/companies", "/api/forms"}) {
            mockMvc.perform(get(path).header("Authorization", "Bearer " + token))
                    .andExpect(status().isForbidden());
        }
        // An empty evaluation reaches DTO validation (400), not access denial (403).
        // Its business implementation belongs to another task and is not mocked here.
        mockMvc.perform(post("/api/personalized-evaluations").header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isBadRequest());
        mockMvc.perform(post("/api/personalized-evaluations")
                .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isUnauthorized());
    }

    private MockEnvironment configuration() {
        return new MockEnvironment().withProperty(PREFIX + "first-name", "Test")
                .withProperty(PREFIX + "first-last-name", "Ergonomist")
                .withProperty(PREFIX + "email", "new@example.test")
                .withProperty(PREFIX + "password", PASSWORD);
    }

    private void runWith(MockEnvironment environment) {
        new ErgonomistInitializer(userRepository, passwordEncoder, environment, validator)
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
