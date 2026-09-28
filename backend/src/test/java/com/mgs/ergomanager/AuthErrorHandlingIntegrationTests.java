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

import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Checks that every misuse of the login and password change endpoints answers
 * with the shared error payload and a message the user can understand.
 */
@SpringBootTest
@ActiveProfiles("test")
class AuthErrorHandlingIntegrationTests {

    private static final String EMAIL = "user@example.com";
    private static final String PASSWORD = "Original1!";
    private static final String BAD_CREDENTIALS = "El correo o la contraseña son incorrectos.";
    private static final String INVALID_SESSION = "La sesión no es válida. Inicie sesión nuevamente.";

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
        user = new User();
        user.setFirstName("Test");
        user.setFirstLastName("User");
        user.setEmail(EMAIL);
        user.setPassword(passwordEncoder.encode(PASSWORD));
        user.setRole(Role.ADMIN);
        user = userRepository.saveAndFlush(user);
    }

    @Test
    void wrongPasswordAndUnknownEmailShareTheSameMessage() throws Exception {
        login(EMAIL, "Incorrect1!").andExpect(status().isUnauthorized())
                .andExpect(jsonPath("message").value(BAD_CREDENTIALS))
                .andExpect(jsonPath("path").value("/api/auth/login"));
        login("nobody@example.com", PASSWORD).andExpect(status().isUnauthorized())
                .andExpect(jsonPath("message").value(BAD_CREDENTIALS));
    }

    @Test
    void shortPasswordIsTreatedAsWrongCredentialsNotAsValidationError() throws Exception {
        login(EMAIL, "abc").andExpect(status().isUnauthorized())
                .andExpect(jsonPath("message").value(BAD_CREDENTIALS));
    }

    @Test
    void passwordOverBcryptLimitIsRejectedAsWrongCredentials() throws Exception {
        login(EMAIL, "ñ".repeat(40)).andExpect(status().isUnauthorized())
                .andExpect(jsonPath("message").value(BAD_CREDENTIALS));
        login("nobody@example.com", "ñ".repeat(40)).andExpect(status().isUnauthorized())
                .andExpect(jsonPath("message").value(BAD_CREDENTIALS));
    }

    @Test
    void inactiveAccountIsOnlyReportedAfterTheRightPassword() throws Exception {
        user.setActive(false);
        userRepository.saveAndFlush(user);
        login(EMAIL, "Incorrect1!").andExpect(status().isUnauthorized())
                .andExpect(jsonPath("message").value(BAD_CREDENTIALS));
        login(EMAIL, PASSWORD).andExpect(status().isUnauthorized())
                .andExpect(jsonPath("message").value("La cuenta está desactivada. Contacte al administrador."));
    }

    @Test
    void invalidLoginFieldsAreReportedInSpanish() throws Exception {
        login("", "").andExpect(status().isBadRequest())
                .andExpect(jsonPath("message").value("Revise los datos ingresados."))
                .andExpect(jsonPath("fieldErrors.email").value("El correo es obligatorio."))
                .andExpect(jsonPath("fieldErrors.password").value("La contraseña es obligatoria."));
        login("not-an-email", PASSWORD).andExpect(status().isBadRequest())
                .andExpect(jsonPath("fieldErrors.email").value("El correo no tiene un formato válido."));
    }

    @ParameterizedTest
    @ValueSource(strings = {"", "{", "not json", "[]", "{\"email\": 5, \"password\": {}}"})
    void malformedLoginBodyAnswersBadRequest(String body) throws Exception {
        mockMvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("message").value("El cuerpo de la solicitud no es válido."));
    }

    @Test
    void wrongContentTypeAndMethodAreNotServerErrors() throws Exception {
        mockMvc.perform(post("/api/auth/login").contentType(MediaType.TEXT_PLAIN).content("x"))
                .andExpect(status().isUnsupportedMediaType())
                .andExpect(jsonPath("message").exists());
        mockMvc.perform(get("/api/auth/login"))
                .andExpect(status().isMethodNotAllowed())
                .andExpect(jsonPath("message").exists());
    }

    @Test
    void missingTokenAnswersWithErrorBody() throws Exception {
        changePassword(null).andExpect(status().isUnauthorized())
                .andExpect(jsonPath("message").value("Debe iniciar sesión para continuar."))
                .andExpect(jsonPath("path").value("/api/auth/password"));
    }

    @ParameterizedTest
    @ValueSource(strings = {"", " ", "not-a-jwt", "a.b.c"})
    void malformedTokenAnswersUnauthorized(String token) throws Exception {
        changePassword(token).andExpect(status().isUnauthorized())
                .andExpect(jsonPath("message").value(INVALID_SESSION));
    }

    @Test
    void expiredTokenAsksToSignInAgain() throws Exception {
        changePassword(token(EMAIL, new Date(System.currentTimeMillis() - 10000)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("message").value("Su sesión expiró. Inicie sesión nuevamente."));
    }

    @Test
    void tokenOfDeletedUserAnswersUnauthorized() throws Exception {
        String token = token(EMAIL, new Date(System.currentTimeMillis() + 60000));
        userRepository.deleteAll();
        changePassword(token).andExpect(status().isUnauthorized())
                .andExpect(jsonPath("message").value(INVALID_SESSION));
    }

    @Test
    void revokedTokenAnswersUnauthorized() throws Exception {
        String token = JsonPath.read(login(EMAIL, PASSWORD).andReturn().getResponse().getContentAsString(), "$.token");
        user.setTokenVersion(1);
        userRepository.saveAndFlush(user);
        changePassword(token).andExpect(status().isUnauthorized())
                .andExpect(jsonPath("message").value(INVALID_SESSION));
    }

    @Test
    void forbiddenRoleAnswersWithErrorBody() throws Exception {
        user.setRole(Role.ERGONOMIST);
        userRepository.saveAndFlush(user);
        String token = JsonPath.read(login(EMAIL, PASSWORD).andReturn().getResponse().getContentAsString(), "$.token");
        mockMvc.perform(get("/api/users").header("Authorization", "Bearer " + token))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("message").value("No tiene permisos para realizar esta acción."));
    }

    @Test
    void blankNewPasswordReportsTheRequiredMessage() throws Exception {
        String token = JsonPath.read(login(EMAIL, PASSWORD).andReturn().getResponse().getContentAsString(), "$.token");
        mockMvc.perform(put("/api/auth/password").header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(jsonMapper.writeValueAsString(Map.of("currentPassword", PASSWORD, "newPassword", ""))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("fieldErrors.newPassword").value("La nueva contraseña es obligatoria."));
    }

    private ResultActions login(String email, String password) throws Exception {
        return mockMvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content(jsonMapper.writeValueAsString(Map.of("email", email, "password", password))));
    }

    private ResultActions changePassword(String token) throws Exception {
        var request = put("/api/auth/password").contentType(MediaType.APPLICATION_JSON)
                .content(jsonMapper.writeValueAsString(Map.of("currentPassword", PASSWORD,
                        "newPassword", "Replacement2!")));
        if (token != null) {
            request.header("Authorization", "Bearer " + token);
        }
        return mockMvc.perform(request);
    }

    private String token(String email, Date expiration) {
        return Jwts.builder().subject(email).claim("role", "ADMIN").claim("tokenVersion", 0)
                .issuedAt(new Date(System.currentTimeMillis() - 20000)).expiration(expiration)
                .signWith(Keys.hmacShaKeyFor(jwtSecret.getBytes(StandardCharsets.UTF_8))).compact();
    }
}
