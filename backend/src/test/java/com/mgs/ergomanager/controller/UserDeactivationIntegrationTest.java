package com.mgs.ergomanager.controller;

import com.jayway.jsonpath.JsonPath;
import com.mgs.ergomanager.exception.BusinessException;
import com.mgs.ergomanager.model.User;
import com.mgs.ergomanager.model.enums.Role;
import com.mgs.ergomanager.repository.UserRepository;
import com.mgs.ergomanager.service.UserService;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import tools.jackson.databind.json.JsonMapper;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Verifies the soft delete of users through real login, JWT validation and database writes. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class UserDeactivationIntegrationTest {

    private static final String PASSWORD = "Deactivate123!";

    @Autowired
    private MockMvc mockMvc;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private UserService userService;
    @Autowired
    private PasswordEncoder passwordEncoder;

    private final JsonMapper jsonMapper = JsonMapper.builder().build();
    private User admin;
    private User target;
    private String adminToken;

    @BeforeEach
    void setUp() throws Exception {
        userRepository.deleteAll();
        admin = createUser("admin@example.test", Role.ADMIN);
        target = createUser("target@example.test", Role.ERGONOMIST);
        adminToken = token(admin.getEmail());
    }

    @Test
    void deactivationKeepsTheRowAndOnlyChangesTheActiveFlag() throws Exception {
        long count = userRepository.count();
        deactivate(adminToken, target.getId()).andExpect(status().isNoContent());
        User stored = userRepository.findById(target.getId()).orElseThrow();
        assertThat(userRepository.count()).isEqualTo(count);
        assertThat(stored.isActive()).isFalse();
        assertThat(stored.getTokenVersion()).isEqualTo(1);
        assertThat(stored.getEmail()).isEqualTo(target.getEmail());
        assertThat(stored.getRole()).isEqualTo(Role.ERGONOMIST);
        assertThat(stored.getPassword()).isEqualTo(target.getPassword());
        assertThat(stored.getFirstName()).isEqualTo(target.getFirstName());
        assertThat(stored.getCreatedAt()).isEqualTo(target.getCreatedAt());
    }

    @Test
    void deactivatedUserCannotSignInAndLosesOpenSessions() throws Exception {
        String targetToken = token(target.getEmail());
        deactivate(adminToken, target.getId()).andExpect(status().isNoContent());
        login(target.getEmail()).andExpect(status().isUnauthorized())
                .andExpect(jsonPath("message").value("La cuenta está desactivada. Contacte al administrador."));
        // An empty evaluation would reach validation (400) with a valid session.
        mockMvc.perform(post("/api/personalized-evaluations").header("Authorization", "Bearer " + targetToken)
                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void deactivatingAnInactiveUserChangesNothing() throws Exception {
        deactivate(adminToken, target.getId()).andExpect(status().isNoContent());
        deactivate(adminToken, target.getId()).andExpect(status().isNoContent());
        User stored = userRepository.findById(target.getId()).orElseThrow();
        assertThat(stored.isActive()).isFalse();
        assertThat(stored.getTokenVersion()).isEqualTo(1);
    }

    @Test
    void deactivationOnlyAffectsTheRequestedUser() throws Exception {
        User other = createUser("other@example.test", Role.ERGONOMIST);
        deactivate(adminToken, target.getId()).andExpect(status().isNoContent());
        User untouched = userRepository.findById(other.getId()).orElseThrow();
        assertThat(untouched.isActive()).isTrue();
        assertThat(untouched.getTokenVersion()).isZero();
        login(other.getEmail()).andExpect(status().isOk());
    }

    @Test
    void administratorCanDeactivateAnotherAdministrator() throws Exception {
        User secondAdmin = createUser("second-admin@example.test", Role.ADMIN);
        deactivate(adminToken, secondAdmin.getId()).andExpect(status().isNoContent());
        assertThat(userRepository.findById(secondAdmin.getId()).orElseThrow().isActive()).isFalse();
        login(secondAdmin.getEmail()).andExpect(status().isUnauthorized());
    }

    @Test
    void administratorCannotDeactivateTheirOwnAccount() throws Exception {
        createUser("second-admin@example.test", Role.ADMIN);
        deactivate(adminToken, admin.getId()).andExpect(status().isBadRequest())
                .andExpect(jsonPath("message").value("No puede desactivar su propia cuenta."));
        User stored = userRepository.findById(admin.getId()).orElseThrow();
        assertThat(stored.isActive()).isTrue();
        assertThat(stored.getTokenVersion()).isZero();
    }

    @Test
    void lastActiveAdministratorIsNeverDeactivated() {
        // Over HTTP the only active administrator is always the caller, so the service is called directly.
        assertThatThrownBy(() -> userService.deactivate(admin.getId(), "someone-else@example.test"))
                .isInstanceOf(BusinessException.class)
                .hasMessage("No se puede desactivar al único administrador activo.");
        assertThat(userRepository.findById(admin.getId()).orElseThrow().isActive()).isTrue();
    }

    @Test
    void unknownUserAnswersNotFound() throws Exception {
        deactivate(adminToken, Long.MAX_VALUE).andExpect(status().isNotFound());
    }

    @Test
    void onlyAdministratorsCanDeactivate() throws Exception {
        String ergonomistToken = token(target.getEmail());
        User other = createUser("other@example.test", Role.ERGONOMIST);
        deactivate(ergonomistToken, other.getId()).andExpect(status().isForbidden());
        deactivate(null, other.getId()).andExpect(status().isUnauthorized());
        assertThat(userRepository.findById(other.getId()).orElseThrow().isActive()).isTrue();
    }

    @Test
    void editingKeepsTheDeactivatedUserInactive() throws Exception {
        deactivate(adminToken, target.getId()).andExpect(status().isNoContent());
        mockMvc.perform(put("/api/users/{id}", target.getId()).header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(jsonMapper.writeValueAsString(Map.of("firstName", "Edited", "firstLastName", "User",
                                "email", target.getEmail(), "role", "ADMIN"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("active").value(false));
        login(target.getEmail()).andExpect(status().isUnauthorized());
    }

    private ResultActions deactivate(String token, Long id) throws Exception {
        var request = delete("/api/users/{id}", id);
        if (token != null) {
            request.header("Authorization", "Bearer " + token);
        }
        return mockMvc.perform(request);
    }

    private ResultActions login(String email) throws Exception {
        return mockMvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content(jsonMapper.writeValueAsString(Map.of("email", email, "password", PASSWORD))));
    }

    private String token(String email) throws Exception {
        String body = login(email).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return JsonPath.read(body, "$.token");
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
