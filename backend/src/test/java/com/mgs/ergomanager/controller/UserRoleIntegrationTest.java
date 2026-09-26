package com.mgs.ergomanager.controller;

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
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import tools.jackson.databind.json.JsonMapper;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Verifies role changes through real login, JWT validation and database writes. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class UserRoleIntegrationTest {

    private static final String PASSWORD = "RoleTest123!";

    @Autowired
    private MockMvc mockMvc;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private PasswordEncoder passwordEncoder;
    @Value("${ergomanager.security.jwt.secret}")
    private String jwtSecret;

    private final JsonMapper jsonMapper = JsonMapper.builder().build();
    private User admin;
    private User target;
    private String adminToken;

    @BeforeEach
    void setUp() throws Exception {
        userRepository.deleteAll();
        admin = createUser("admin@example.test", Role.ADMIN);
        target = createUser("target@example.test", Role.ERGONOMIST);
        adminToken = login(admin);
    }

    @ParameterizedTest
    @EnumSource(Role.class)
    void roleChangeRevokesOldSessionAndNewLoginUsesNewPermissions(Role previousRole) throws Exception {
        target.setRole(previousRole);
        userRepository.saveAndFlush(target);
        String oldToken = login(target);
        Role newRole = previousRole == Role.ADMIN ? Role.ERGONOMIST : Role.ADMIN;
        update(adminToken, target, newRole).andExpect(status().isOk())
                .andExpect(jsonPath("role").value(newRole.name()));
        User stored = userRepository.findById(target.getId()).orElseThrow();
        assertThat(stored.getRole()).isEqualTo(newRole);
        assertThat(stored.getTokenVersion()).isEqualTo(1);
        assertThat(stored.getPassword()).isEqualTo(target.getPassword());
        assertThat(stored.isActive()).isTrue();
        mockMvc.perform(get("/api/users").header("Authorization", "Bearer " + oldToken))
                .andExpect(status().isUnauthorized());
        assertPermissions(login(stored), newRole);
        // Reverting the role must not resurrect the original session.
        update(adminToken, stored, previousRole).andExpect(status().isOk());
        mockMvc.perform(get("/api/users").header("Authorization", "Bearer " + oldToken))
                .andExpect(status().isUnauthorized());
        assertThat(userRepository.findById(target.getId()).orElseThrow().getTokenVersion()).isEqualTo(2);
    }

    @Test
    void profileEditWithSameRoleKeepsSession() throws Exception {
        String token = login(target);
        target.setFirstName("Updated");
        update(adminToken, target, Role.ERGONOMIST).andExpect(status().isOk());
        assertThat(userRepository.findById(target.getId()).orElseThrow().getTokenVersion()).isZero();
        assertPermissions(token, Role.ERGONOMIST);
    }

    @Test
    void ergonomistCannotPromoteSelfAndAnonymousCannotEdit() throws Exception {
        update(login(target), target, Role.ADMIN).andExpect(status().isForbidden());
        update(null, target, Role.ADMIN).andExpect(status().isUnauthorized());
        assertThat(userRepository.findById(target.getId()).orElseThrow().getRole()).isEqualTo(Role.ERGONOMIST);
        assertThat(userRepository.findById(target.getId()).orElseThrow().getTokenVersion()).isZero();
    }

    @Test
    void lastAdminRejectionKeepsRoleAndSession() throws Exception {
        update(adminToken, admin, Role.ERGONOMIST).andExpect(status().isBadRequest());
        assertThat(userRepository.findById(admin.getId()).orElseThrow().getTokenVersion()).isZero();
        update(adminToken, target, Role.ADMIN).andExpect(status().isOk());
    }

    @Test
    void administratorCanDemoteSelfWhenAnotherRemains() throws Exception {
        target.setRole(Role.ADMIN);
        userRepository.saveAndFlush(target);
        update(adminToken, admin, Role.ERGONOMIST).andExpect(status().isOk());
        update(adminToken, target, Role.ERGONOMIST).andExpect(status().isUnauthorized());
        assertPermissions(login(userRepository.findById(admin.getId()).orElseThrow()), Role.ERGONOMIST);
    }

    @Test
    void legacyTokenIsAcceptedUntilRoleChanges() throws Exception {
        String legacy = Jwts.builder().subject(target.getEmail()).claim("role", "ERGONOMIST")
                .expiration(new Date(System.currentTimeMillis() + 60000))
                .signWith(Keys.hmacShaKeyFor(jwtSecret.getBytes(StandardCharsets.UTF_8))).compact();
        assertPermissions(legacy, Role.ERGONOMIST);
        update(adminToken, target, Role.ADMIN).andExpect(status().isOk());
        mockMvc.perform(get("/api/users").header("Authorization", "Bearer " + legacy))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void inactiveAccountDoesNotGainAccessAfterPromotion() throws Exception {
        String token = login(target);
        target.setActive(false);
        userRepository.saveAndFlush(target);
        update(adminToken, target, Role.ADMIN).andExpect(status().isOk());
        assertThat(userRepository.findById(target.getId()).orElseThrow().isActive()).isFalse();
        mockMvc.perform(get("/api/users").header("Authorization", "Bearer " + token))
                .andExpect(status().isUnauthorized());
    }

    private void assertPermissions(String token, Role role) throws Exception {
        // Empty bodies verify access at controller validation without calling unfinished services.
        mockMvc.perform(put("/api/users/{id}", target.getId()).header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(role == Role.ADMIN ? status().isBadRequest() : status().isForbidden());
        mockMvc.perform(post("/api/personalized-evaluations").header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(role == Role.ERGONOMIST ? status().isBadRequest() : status().isForbidden());
    }

    private ResultActions update(String token, User user, Role role) throws Exception {
        var request = put("/api/users/{id}", user.getId()).contentType(MediaType.APPLICATION_JSON)
                .content(jsonMapper.writeValueAsString(Map.of("firstName", user.getFirstName(),
                        "firstLastName", user.getFirstLastName(), "email", user.getEmail(), "role", role.name())));
        if (token != null) {
            request.header("Authorization", "Bearer " + token);
        }
        return mockMvc.perform(request);
    }

    private String login(User user) throws Exception {
        String response = mockMvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content(jsonMapper.writeValueAsString(Map.of("email", user.getEmail(), "password", PASSWORD))))
                .andExpect(status().isOk()).andExpect(jsonPath("role").value(user.getRole().name()))
                .andReturn().getResponse().getContentAsString();
        return JsonPath.read(response, "$.token");
    }

    private User createUser(String email, Role role) {
        User user = new User();
        user.setFirstName("Test");
        user.setFirstLastName("User");
        user.setEmail(email);
        user.setRole(role);
        user.setPassword(passwordEncoder.encode(PASSWORD));
        return userRepository.saveAndFlush(user);
    }
}
