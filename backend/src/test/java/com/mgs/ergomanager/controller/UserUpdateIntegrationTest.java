package com.mgs.ergomanager.controller;

import com.mgs.ergomanager.model.User;
import com.mgs.ergomanager.model.enums.Role;
import com.mgs.ergomanager.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Integration tests for the user update endpoint.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class UserUpdateIntegrationTest {

    private static final String ORIGINAL_PASSWORD_HASH =
            "$2a$10$abcdefghijklmnopqrstuv";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserRepository userRepository;

    private User existingUser;

    /**
     * Cleans the in-memory database and creates the default test user.
     */
    @BeforeEach
    void setUp() {
        userRepository.deleteAll();

        existingUser = createUser(
                "Carlos",
                "Mora",
                "Jimenez",
                "carlos@example.com",
                ORIGINAL_PASSWORD_HASH,
                Role.ERGONOMIST,
                true);
    }

    /**
     * Verifies that an administrator can update an existing user.
     *
     * @throws Exception when the request cannot be executed
     */
    @Test
    void shouldUpdateExistingUser() throws Exception {
        String requestBody = """
                {
                  "firstName": "Carlos Alberto",
                  "firstLastName": "Mora",
                  "secondLastName": "Jimenez",
                  "email": "carlos.actualizado@example.com",
                  "role": "ADMIN"
                }
                """;

        mockMvc.perform(put("/api/users/{id}", existingUser.getId())
                        .with(user("admin@example.com").roles("ADMIN"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestBody))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.firstName").value("Carlos Alberto"))
                .andExpect(jsonPath("$.email")
                        .value("carlos.actualizado@example.com"))
                .andExpect(jsonPath("$.role").value("ADMIN"));
    }

    /**
     * Verifies that another user's email cannot be reused.
     *
     * @throws Exception when the request cannot be executed
     */
    @Test
    void shouldReturnConflictWhenEmailBelongsToAnotherUser()
            throws Exception {

        createUser(
                "Ana",
                "Lopez",
                "Vargas",
                "ana@example.com",
                ORIGINAL_PASSWORD_HASH,
                Role.ERGONOMIST,
                true);

        String requestBody = """
                {
                  "firstName": "Carlos",
                  "firstLastName": "Mora",
                  "secondLastName": "Jimenez",
                  "email": "ana@example.com",
                  "role": "ERGONOMIST"
                }
                """;

        mockMvc.perform(put("/api/users/{id}", existingUser.getId())
                        .with(user("admin@example.com").roles("ADMIN"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestBody))
                .andExpect(status().isConflict());
    }

    /**
     * Verifies that keeping the user's current email is allowed.
     *
     * @throws Exception when the request cannot be executed
     */
    @Test
    void shouldAllowKeepingSameEmail() throws Exception {
        String requestBody = """
                {
                  "firstName": "Carlos Alberto",
                  "firstLastName": "Mora",
                  "secondLastName": "Jimenez",
                  "email": "carlos@example.com",
                  "role": "ERGONOMIST"
                }
                """;

        mockMvc.perform(put("/api/users/{id}", existingUser.getId())
                        .with(user("admin@example.com").roles("ADMIN"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestBody))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email")
                        .value("carlos@example.com"));
    }

    /**
     * Verifies that updating a missing user returns HTTP 404.
     *
     * @throws Exception when the request cannot be executed
     */
    @Test
    void shouldReturnNotFoundWhenUserDoesNotExist() throws Exception {
        String requestBody = """
                {
                  "firstName": "Carlos",
                  "firstLastName": "Mora",
                  "secondLastName": "Jimenez",
                  "email": "carlos@example.com",
                  "role": "ERGONOMIST"
                }
                """;

        mockMvc.perform(put("/api/users/{id}", 999999L)
                        .with(user("admin@example.com").roles("ADMIN"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestBody))
                .andExpect(status().isNotFound());
    }

    /**
     * Verifies that invalid field values return HTTP 400.
     *
     * @throws Exception when the request cannot be executed
     */
    @Test
    void shouldReturnBadRequestWhenBodyIsInvalid() throws Exception {
        String requestBody = """
                {
                  "firstName": "",
                  "firstLastName": "Mora",
                  "secondLastName": "Jimenez",
                  "email": "invalid-email",
                  "role": null
                }
                """;

        mockMvc.perform(put("/api/users/{id}", existingUser.getId())
                        .with(user("admin@example.com").roles("ADMIN"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestBody))
                .andExpect(status().isBadRequest());
    }

    /**
     * Verifies that an unknown role returns HTTP 400 instead of HTTP 500.
     *
     * @throws Exception when the request cannot be executed
     */
    @Test
    void shouldReturnBadRequestWhenRoleDoesNotExist() throws Exception {
        String requestBody = """
                {
                  "firstName": "Carlos",
                  "firstLastName": "Mora",
                  "secondLastName": "Jimenez",
                  "email": "carlos@example.com",
                  "role": "EMPLOYEE"
                }
                """;

        mockMvc.perform(put("/api/users/{id}", existingUser.getId())
                        .with(user("admin@example.com").roles("ADMIN"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestBody))
                .andExpect(status().isBadRequest());
    }

    /**
     * Verifies that an ergonomist cannot update users.
     *
     * @throws Exception when the request cannot be executed
     */
    @Test
    void shouldReturnForbiddenForErgonomist() throws Exception {
        String requestBody = """
                {
                  "firstName": "Carlos",
                  "firstLastName": "Mora",
                  "secondLastName": "Jimenez",
                  "email": "carlos@example.com",
                  "role": "ERGONOMIST"
                }
                """;

        mockMvc.perform(put("/api/users/{id}", existingUser.getId())
                        .with(user("ergonomist@example.com")
                                .roles("ERGONOMIST"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestBody))
                .andExpect(status().isForbidden());
    }

    /**
     * Verifies that updating user data does not change the password hash.
     *
     * @throws Exception when the request cannot be executed
     */
    @Test
    void shouldPreservePasswordAfterUpdate() throws Exception {
        String requestBody = """
                {
                  "firstName": "Carlos Alberto",
                  "firstLastName": "Mora",
                  "secondLastName": "Jimenez",
                  "email": "carlos.actualizado@example.com",
                  "role": "ERGONOMIST"
                }
                """;

        mockMvc.perform(put("/api/users/{id}", existingUser.getId())
                        .with(user("admin@example.com").roles("ADMIN"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestBody))
                .andExpect(status().isOk());

        User updatedUser = userRepository.findById(existingUser.getId())
                .orElseThrow();

        org.junit.jupiter.api.Assertions.assertEquals(
                ORIGINAL_PASSWORD_HASH,
                updatedUser.getPassword());
    }

    /**
     * Verifies that the only active administrator cannot lose the admin role.
     *
     * @throws Exception when the request cannot be executed
     */
    @Test
    void shouldRejectChangingOnlyActiveAdminToErgonomist()
            throws Exception {

        userRepository.deleteAll();

        User onlyAdmin = createUser(
                "Admin",
                "Principal",
                "Sistema",
                "admin@example.com",
                ORIGINAL_PASSWORD_HASH,
                Role.ADMIN,
                true);

        String requestBody = """
                {
                  "firstName": "Admin",
                  "firstLastName": "Principal",
                  "secondLastName": "Sistema",
                  "email": "admin@example.com",
                  "role": "ERGONOMIST"
                }
                """;

        mockMvc.perform(put("/api/users/{id}", onlyAdmin.getId())
                        .with(user("admin@example.com").roles("ADMIN"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestBody))
                .andExpect(status().isBadRequest());

        User unchangedAdmin = userRepository.findById(onlyAdmin.getId())
                .orElseThrow();

        org.junit.jupiter.api.Assertions.assertEquals(
                Role.ADMIN,
                unchangedAdmin.getRole());
    }

    /**
     * Verifies that an administrator can change role when another active
     * administrator remains in the system.
     *
     * @throws Exception when the request cannot be executed
     */
    @Test
    void shouldAllowRoleChangeWhenAnotherActiveAdminExists()
            throws Exception {

        userRepository.deleteAll();

        User firstAdmin = createUser(
                "Admin",
                "Uno",
                "Sistema",
                "admin1@example.com",
                ORIGINAL_PASSWORD_HASH,
                Role.ADMIN,
                true);

        createUser(
                "Admin",
                "Dos",
                "Sistema",
                "admin2@example.com",
                ORIGINAL_PASSWORD_HASH,
                Role.ADMIN,
                true);

        String requestBody = """
                {
                  "firstName": "Admin",
                  "firstLastName": "Uno",
                  "secondLastName": "Sistema",
                  "email": "admin1@example.com",
                  "role": "ERGONOMIST"
                }
                """;

        mockMvc.perform(put("/api/users/{id}", firstAdmin.getId())
                        .with(user("admin2@example.com").roles("ADMIN"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestBody))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.role").value("ERGONOMIST"));
    }

    /**
     * Creates and stores a user for an integration test.
     *
     * @param firstName      given name
     * @param firstLastName  first surname
     * @param secondLastName second surname
     * @param email          email address
     * @param password       stored password hash
     * @param role           assigned role
     * @param active         active state
     * @return persisted user
     */
    private User createUser(String firstName,
                            String firstLastName,
                            String secondLastName,
                            String email,
                            String password,
                            Role role,
                            boolean active) {

        User newUser = new User();
        newUser.setFirstName(firstName);
        newUser.setFirstLastName(firstLastName);
        newUser.setSecondLastName(secondLastName);
        newUser.setEmail(email);
        newUser.setPassword(password);
        newUser.setRole(role);
        newUser.setActive(active);

        return userRepository.save(newUser);
    }
}