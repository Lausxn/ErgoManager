package com.mgs.ergomanager;

import com.jayway.jsonpath.JsonPath;
import com.mgs.ergomanager.model.User;
import com.mgs.ergomanager.model.enums.Role;
import com.mgs.ergomanager.repository.UserRepository;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;
import tools.jackson.databind.json.JsonMapper;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Exercises the HTTP contract, real JWT/BCrypt security and committed database writes.
 */
@SpringBootTest
@ActiveProfiles("test")
class ChangePasswordIntegrationTests {

    private static final String EMAIL = "user@example.com";
    private static final String CURRENT_PASSWORD = "Original1!";
    private static final String NEW_PASSWORD = "Replacement2!";

    @Autowired
    private WebApplicationContext context;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Value("${ergomanager.security.jwt.secret}")
    private String jwtSecret;

    private final JsonMapper jsonMapper = JsonMapper.builder().build();
    private MockMvc mockMvc;
    private User user;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        userRepository.deleteAll();
        user = createUser(EMAIL, Role.ADMIN);
    }

    @ParameterizedTest
    @EnumSource(Role.class)
    void persistsHashAndRenewsSessionForBothRoles(Role role) throws Exception {
        user.setRole(role);
        userRepository.saveAndFlush(user);
        String oldToken = login(CURRENT_PASSWORD);
        String response = change(oldToken, CURRENT_PASSWORD, NEW_PASSWORD)
                .andExpect(status().isOk())
                .andExpect(jsonPath("tokenType").value("Bearer"))
                .andExpect(jsonPath("userId").value(user.getId()))
                .andExpect(jsonPath("fullName").value("Test User"))
                .andExpect(jsonPath("role").value(role.name()))
                .andExpect(jsonPath("password").doesNotExist())
                .andReturn().getResponse().getContentAsString();
        User stored = storedUser();
        assertThat(stored.getPassword()).startsWith("$2").isNotEqualTo(NEW_PASSWORD);
        assertThat(passwordEncoder.matches(NEW_PASSWORD, stored.getPassword())).isTrue();
        assertThat(passwordEncoder.matches(CURRENT_PASSWORD, stored.getPassword())).isFalse();
        assertThat(stored.getTokenVersion()).isEqualTo(1);
        assertThat(stored.getEmail()).isEqualTo(EMAIL);
        assertThat(stored.getRole()).isEqualTo(role);
        assertThat(stored.isActive()).isTrue();
        String newToken = JsonPath.read(response, "$.token");
        assertThat(newToken).isNotEqualTo(oldToken);
        Number expiresAt = JsonPath.read(response, "$.expiresAtMs");
        assertThat(expiresAt.longValue()).isGreaterThan(System.currentTimeMillis());
        change(oldToken, NEW_PASSWORD, "ThirdPassword3!").andExpect(status().isUnauthorized());
        change(newToken, NEW_PASSWORD, "ThirdPassword3!").andExpect(status().isOk());
        loginRequest(CURRENT_PASSWORD).andExpect(status().isUnauthorized());
        loginRequest(NEW_PASSWORD).andExpect(status().isUnauthorized());
        login("ThirdPassword3!");
    }

    @ParameterizedTest
    @ValueSource(strings = {"", "not-a-jwt"})
    void requiresValidAuthentication(String token) throws Exception {
        change(token, CURRENT_PASSWORD, NEW_PASSWORD).andExpect(status().isUnauthorized());
        assertUnchanged();
    }

    @Test
    void rejectsExpiredToken() throws Exception {
        change(legacyToken(new Date(System.currentTimeMillis() - 10000)), CURRENT_PASSWORD, NEW_PASSWORD)
                .andExpect(status().isUnauthorized());
        assertUnchanged();
    }

    @Test
    void rejectsWrongCurrentPasswordWithoutSigningOut() throws Exception {
        String token = login(CURRENT_PASSWORD);
        change(token, "Incorrect1!", NEW_PASSWORD).andExpect(status().isBadRequest())
                .andExpect(jsonPath("message").value("Current password is incorrect"));
        assertUnchanged();
        change(token, CURRENT_PASSWORD, NEW_PASSWORD).andExpect(status().isOk());
    }

    @Test
    void rejectsReusingCurrentPassword() throws Exception {
        change(login(CURRENT_PASSWORD), CURRENT_PASSWORD, CURRENT_PASSWORD).andExpect(status().isBadRequest());
        assertUnchanged();
    }

    @ParameterizedTest
    @ValueSource(strings = {"", "        ", "Aa1!", "lowercase1!", "UPPERCASE1!", "NoNumber!!", "NoSymbol123"})
    void rejectsWeakPasswords(String newPassword) throws Exception {
        change(login(CURRENT_PASSWORD), CURRENT_PASSWORD, newPassword).andExpect(status().isBadRequest())
                .andExpect(jsonPath("fieldErrors.newPassword").exists());
        assertUnchanged();
    }

    @ParameterizedTest
    @ValueSource(strings = {"{}", "{\"currentPassword\":\"Original1!\"}",
            "{\"newPassword\":\"Replacement2!\"}",
            "{\"currentPassword\":null,\"newPassword\":null}"})
    void rejectsMissingPasswords(String body) throws Exception {
        mockMvc.perform(put("/api/auth/password").header("Authorization", "Bearer " + login(CURRENT_PASSWORD))
                .contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isBadRequest());
        assertUnchanged();
    }

    @Test
    void enforcesBcryptByteLimitForUnicodePasswords() throws Exception {
        String token = login(CURRENT_PASSWORD);
        change(token, CURRENT_PASSWORD, "Áa1!" + "ñ".repeat(34)).andExpect(status().isBadRequest());
        change(token, CURRENT_PASSWORD, "Aa1!" + "x".repeat(69)).andExpect(status().isBadRequest());
        change(token, "ñ".repeat(40), NEW_PASSWORD).andExpect(status().isBadRequest());
        assertUnchanged();
        String boundaryPassword = "Áa1!" + "ñ".repeat(33) + "x";
        assertThat(boundaryPassword.getBytes(StandardCharsets.UTF_8)).hasSize(72);
        change(token, CURRENT_PASSWORD, boundaryPassword).andExpect(status().isOk());
        login(boundaryPassword);
    }

    @Test
    void changesOnlyAuthenticatedUserEvenWhenAnotherIdentityIsSupplied() throws Exception {
        User other = createUser("other@example.com", Role.ERGONOMIST);
        String body = jsonMapper.writeValueAsString(Map.of("currentPassword", CURRENT_PASSWORD,
                "newPassword", NEW_PASSWORD, "email", other.getEmail(), "userId", other.getId()));
        mockMvc.perform(put("/api/auth/password").header("Authorization", "Bearer " + login(CURRENT_PASSWORD))
                .contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isOk());
        User unchanged = userRepository.findById(other.getId()).orElseThrow();
        assertThat(unchanged.getPassword()).isEqualTo(other.getPassword());
        assertThat(unchanged.getTokenVersion()).isZero();
        assertThat(passwordEncoder.matches(NEW_PASSWORD, storedUser().getPassword())).isTrue();
    }

    @Test
    void acceptsTask77TokenOnlyUntilFirstPasswordChange() throws Exception {
        String token = legacyToken(new Date(System.currentTimeMillis() + 60000));
        change(token, CURRENT_PASSWORD, NEW_PASSWORD).andExpect(status().isOk());
        change(token, NEW_PASSWORD, "ThirdPassword3!").andExpect(status().isUnauthorized());
        login(NEW_PASSWORD);
    }

    @Test
    void rejectsInactiveUserWithPreviouslyIssuedToken() throws Exception {
        String token = login(CURRENT_PASSWORD);
        user.setActive(false);
        userRepository.saveAndFlush(user);
        change(token, CURRENT_PASSWORD, NEW_PASSWORD).andExpect(status().isUnauthorized());
        assertUnchanged();
    }

    private User createUser(String email, Role role) {
        User created = new User();
        created.setFirstName("Test");
        created.setFirstLastName("User");
        created.setEmail(email);
        created.setPassword(passwordEncoder.encode(CURRENT_PASSWORD));
        created.setRole(role);
        return userRepository.saveAndFlush(created);
    }

    private User storedUser() {
        // No test transaction: this reload observes the committed endpoint write.
        return userRepository.findById(user.getId()).orElseThrow();
    }

    private void assertUnchanged() {
        assertThat(storedUser().getPassword()).isEqualTo(user.getPassword());
        assertThat(storedUser().getTokenVersion()).isZero();
    }

    private ResultActions loginRequest(String password) throws Exception {
        return mockMvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content(jsonMapper.writeValueAsString(Map.of("email", EMAIL, "password", password))));
    }

    private String login(String password) throws Exception {
        String body = loginRequest(password).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return JsonPath.read(body, "$.token");
    }

    private ResultActions change(String token, String currentPassword, String newPassword) throws Exception {
        var request = put("/api/auth/password").contentType(MediaType.APPLICATION_JSON)
                .content(jsonMapper.writeValueAsString(Map.of("currentPassword", currentPassword,
                        "newPassword", newPassword)));
        if (!token.isEmpty()) {
            request.header("Authorization", "Bearer " + token);
        }
        return mockMvc.perform(request);
    }

    private String legacyToken(Date expiration) {
        return Jwts.builder().subject(EMAIL).claim("role", "ADMIN")
                .issuedAt(new Date(System.currentTimeMillis() - 20000)).expiration(expiration)
                .signWith(Keys.hmacShaKeyFor(jwtSecret.getBytes(StandardCharsets.UTF_8))).compact();
    }
}
