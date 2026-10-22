package com.mgs.ergomanager;

import com.mgs.ergomanager.model.User;
import com.mgs.ergomanager.model.enums.Role;
import com.mgs.ergomanager.repository.UserRepository;
import com.mgs.ergomanager.service.EmailService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Exercises the real creation endpoint and persistence with H2, without sending mail. */
@SpringBootTest
@ActiveProfiles("test")
@Transactional
class UserCreationValidationTests {
    @Autowired private WebApplicationContext context;
    @Autowired private UserRepository repository;
    @Autowired private PasswordEncoder encoder;
    @MockitoBean private EmailService emailService;
    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
    }

    private String body(String name, String email, String password) {
        return "{\"firstName\":\"" + name + "\",\"firstLastName\":\" Prueba \","
                + "\"secondLastName\":\"   \",\"email\":\"" + email + "\","
                + "\"password\":\"" + password + "\",\"role\":\"ERGONOMIST\"}";
    }

    @Test
    void normalizesIdentityAndPersistsHash() throws Exception {
        mvc.perform(post("/api/users").with(user("admin").roles("ADMIN"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(body(" Ana ", " Ana.Validation@Example.test ", "Temporary123!")))
                .andExpect(status().isCreated()).andExpect(jsonPath("email").value("ana.validation@example.test"))
                .andExpect(jsonPath("password").doesNotExist());
        User saved = repository.findByEmail("ana.validation@example.test").orElseThrow();
        assertThat(saved.getFirstName()).isEqualTo("Ana");
        assertThat(saved.getSecondLastName()).isNull();
        assertThat(encoder.matches("Temporary123!", saved.getPassword())).isTrue();
    }

    @Test
    void rejectsNormalizedDuplicateWithoutOverwritingInactiveUser() throws Exception {
        User existing = new User();
        existing.setFirstName("Original"); existing.setFirstLastName("Prueba");
        existing.setEmail("duplicate.validation@example.test"); existing.setRole(Role.ADMIN);
        existing.setPassword(encoder.encode("Original123!")); existing.setActive(false);
        repository.saveAndFlush(existing);
        long count = repository.count();
        mvc.perform(post("/api/users").with(user("admin").roles("ADMIN"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(body("Ana", " DUPLICATE.VALIDATION@EXAMPLE.TEST ", "Temporary123!")))
                .andExpect(status().isConflict());
        assertThat(repository.count()).isEqualTo(count);
        assertThat(existing.isActive()).isFalse();
        assertThat(existing.getFirstName()).isEqualTo("Original");
    }

    @Test
    void returnsFieldErrorsForBlankNameAndInvalidEmail() throws Exception {
        long count = repository.count();
        mvc.perform(post("/api/users").with(user("admin").roles("ADMIN"))
                .contentType(MediaType.APPLICATION_JSON).content(body("   ", "invalid", "Temporary123!")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("fieldErrors.firstName").value("Este campo es obligatorio."))
                .andExpect(jsonPath("fieldErrors.email").value("Escriba un correo válido."));
        assertThat(repository.count()).isEqualTo(count);
    }

    @Test
    void rejectsPasswordOverBcryptByteLimitWithoutWriting() throws Exception {
        long count = repository.count();
        mvc.perform(post("/api/users").with(user("admin").roles("ADMIN"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(body("Ana", "long.validation@example.test", "ñ".repeat(37))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("message").value("La contraseña no puede superar 72 bytes UTF-8."));
        assertThat(repository.count()).isEqualTo(count);
    }

    @Test
    void acceptsExactly72Utf8Bytes() throws Exception {
        mvc.perform(post("/api/users").with(user("admin").roles("ADMIN"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(body("Ana", "boundary.validation@example.test", "ñ".repeat(36))))
                .andExpect(status().isCreated());
    }

    @Test
    void ergonomistCannotCreateUsers() throws Exception {
        mvc.perform(post("/api/users").with(user("ergonomist").roles("ERGONOMIST"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(body("Ana", "forbidden.validation@example.test", "Temporary123!")))
                .andExpect(status().isForbidden());
    }
}
