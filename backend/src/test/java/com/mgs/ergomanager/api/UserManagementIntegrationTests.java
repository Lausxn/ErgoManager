package com.mgs.ergomanager.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.mgs.ergomanager.model.User;
import com.mgs.ergomanager.model.enums.Role;
import java.util.HashMap;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

/** Administration of users: listing, update, deactivation, activation and role restrictions. */
class UserManagementIntegrationTests extends ApiIntegrationTestSupport {

    private User admin;
    private User ergonomist;

    @BeforeEach
    void createUsers() {
        admin = persistUser("admin.users@example.test", Role.ADMIN);
        ergonomist = persistUser("ergo.users@example.test", Role.ERGONOMIST);
    }

    private Map<String, Object> updateBody(User user, Role role) {
        Map<String, Object> body = new HashMap<>();
        body.put("firstName", " Nuevo ");
        body.put("firstLastName", "Apellido");
        body.put("secondLastName", " ");
        body.put("email", " " + user.getEmail().toUpperCase() + " ");
        body.put("role", role.name());
        return body;
    }

    private Map<String, Object> creationBody() {
        Map<String, Object> body = updateBody(ergonomist, Role.ADMIN);
        body.put("email", "nuevo.users@example.test");
        body.put("password", "Temporal123!");
        return body;
    }

    @Test
    void listsUsersNewestFirstWithoutPasswords() throws Exception {
        mvc.perform(get("/api/users").with(as(admin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].email").value(ergonomist.getEmail()))
                .andExpect(jsonPath("$[1].email").value(admin.getEmail()))
                .andExpect(jsonPath("$[0].password").doesNotExist());
    }

    @Test
    void findsUserByIdOrAnswers404() throws Exception {
        mvc.perform(get("/api/users/{id}", ergonomist.getId()).with(as(admin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("role").value("ERGONOMIST"))
                .andExpect(jsonPath("active").value(true));
        mvc.perform(get("/api/users/{id}", 999_999).with(as(admin)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("message").value("No se encontró el usuario."));
    }

    @Test
    void updateKeepsPasswordAndSessionsWhenRoleDoesNotChange() throws Exception {
        String originalHash = ergonomist.getPassword();
        long originalVersion = ergonomist.getTokenVersion();

        mvc.perform(put("/api/users/{id}", ergonomist.getId()).with(as(admin))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(toJson(updateBody(ergonomist, Role.ERGONOMIST))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("firstName").value("Nuevo"))
                .andExpect(jsonPath("email").value("ergo.users@example.test"))
                .andExpect(jsonPath("secondLastName").doesNotExist());

        User stored = userRepository.findById(ergonomist.getId()).orElseThrow();
        assertThat(stored.getPassword()).isEqualTo(originalHash);
        assertThat(stored.getTokenVersion()).isEqualTo(originalVersion);
        assertThat(stored.getFirstName()).isEqualTo("Nuevo");
    }

    @Test
    void roleChangeRevokesSessionsWithoutTouchingThePassword() throws Exception {
        String originalHash = ergonomist.getPassword();
        long originalVersion = ergonomist.getTokenVersion();
        mvc.perform(put("/api/users/{id}", ergonomist.getId()).with(as(admin))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(toJson(updateBody(ergonomist, Role.ADMIN))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("role").value("ADMIN"));
        User stored = userRepository.findById(ergonomist.getId()).orElseThrow();
        assertThat(stored.getPassword()).isEqualTo(originalHash);
        assertThat(stored.getTokenVersion()).isEqualTo(originalVersion + 1);
    }

    @Test
    void passwordSentInAnUpdateIsIgnored() throws Exception {
        String originalHash = ergonomist.getPassword();
        Map<String, Object> body = updateBody(ergonomist, Role.ERGONOMIST);
        body.put("password", "Cambiada123!");
        mvc.perform(put("/api/users/{id}", ergonomist.getId()).with(as(admin))
                        .contentType(MediaType.APPLICATION_JSON).content(toJson(body)))
                .andExpect(status().isOk());
        assertThat(userRepository.findById(ergonomist.getId()).orElseThrow().getPassword()).isEqualTo(originalHash);
    }

    @Test
    void updateRejectsInvalidFields() throws Exception {
        Map<String, Object> blankName = updateBody(ergonomist, Role.ERGONOMIST);
        blankName.put("firstName", "  ");
        mvc.perform(put("/api/users/{id}", ergonomist.getId()).with(as(admin))
                        .contentType(MediaType.APPLICATION_JSON).content(toJson(blankName)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("fieldErrors.firstName").value("Este campo es obligatorio."));
    }

    @Test
    void updateRejectsEmailOfAnotherUser() throws Exception {
        Map<String, Object> body = updateBody(ergonomist, Role.ERGONOMIST);
        body.put("email", "ADMIN.users@example.test");
        mvc.perform(put("/api/users/{id}", ergonomist.getId()).with(as(admin))
                        .contentType(MediaType.APPLICATION_JSON).content(toJson(body)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("message").value("El correo ya está registrado"));
    }

    @Test
    void onlyActiveAdministratorCannotLoseTheRoleButCanEditOwnData() throws Exception {
        mvc.perform(put("/api/users/{id}", admin.getId()).with(as(admin))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(toJson(updateBody(admin, Role.ERGONOMIST))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("message").value("No se puede cambiar el rol del único administrador activo."));
        mvc.perform(put("/api/users/{id}", admin.getId()).with(as(admin))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(toJson(updateBody(admin, Role.ADMIN))))
                .andExpect(status().isOk());
    }

    @Test
    void administratorCanChangeOwnRoleWhenAnotherAdministratorRemains() throws Exception {
        persistUser("second.admin@example.test", Role.ADMIN);
        mvc.perform(put("/api/users/{id}", admin.getId()).with(as(admin))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(toJson(updateBody(admin, Role.ERGONOMIST))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("role").value("ERGONOMIST"));
    }

    @Test
    void updateOfMissingUserAnswers404() throws Exception {
        mvc.perform(put("/api/users/{id}", 999_999).with(as(admin))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(toJson(updateBody(ergonomist, Role.ERGONOMIST))))
                .andExpect(status().isNotFound());
    }

    @Test
    void deactivatesAndActivatesAnotherUser() throws Exception {
        long originalVersion = ergonomist.getTokenVersion();
        mvc.perform(delete("/api/users/{id}", ergonomist.getId()).with(as(admin)))
                .andExpect(status().isNoContent());
        User stored = userRepository.findById(ergonomist.getId()).orElseThrow();
        assertThat(stored.isActive()).isFalse();
        assertThat(stored.getTokenVersion()).isEqualTo(originalVersion + 1);

        mvc.perform(patch("/api/users/{id}/activate", ergonomist.getId()).with(as(admin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("active").value(true));
        // The sessions revoked by the deactivation stay revoked.
        assertThat(userRepository.findById(ergonomist.getId()).orElseThrow().getTokenVersion())
                .isEqualTo(originalVersion + 1);
    }

    @Test
    void adminCannotDeactivateOwnAccount() throws Exception {
        mvc.perform(delete("/api/users/{id}", admin.getId()).with(as(admin)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("message").value("No puede desactivar su propia cuenta."));
        assertThat(userRepository.findById(admin.getId()).orElseThrow().isActive()).isTrue();
    }

    @Test
    void ergonomistIsForbiddenAndAnonymousIsUnauthorized() throws Exception {
        mvc.perform(get("/api/users").with(as(ergonomist))).andExpect(status().isForbidden());
        mvc.perform(post("/api/users").with(as(ergonomist)).contentType(MediaType.APPLICATION_JSON)
                .content(toJson(creationBody())))
                .andExpect(status().isForbidden());
        mvc.perform(put("/api/users/{id}", ergonomist.getId()).with(as(ergonomist))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(toJson(updateBody(ergonomist, Role.ADMIN))))
                .andExpect(status().isForbidden());
        mvc.perform(delete("/api/users/{id}", admin.getId()).with(as(ergonomist))).andExpect(status().isForbidden());
        mvc.perform(patch("/api/users/{id}/activate", admin.getId()).with(as(ergonomist)))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/users")).andExpect(status().isUnauthorized());
    }
}
