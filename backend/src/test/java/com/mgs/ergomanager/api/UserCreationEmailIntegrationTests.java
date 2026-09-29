package com.mgs.ergomanager.api;

import static org.mockito.Mockito.never;
import static org.mockito.Mockito.timeout;
import static org.mockito.Mockito.verify;
import static org.mockito.ArgumentMatchers.anyString;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.mgs.ergomanager.repository.UserRepository;
import com.mgs.ergomanager.service.EmailService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

/**
 * Not transactional on purpose: the credentials email is sent only after the
 * creation transaction commits, which never happens inside a rolled back test.
 */
@SpringBootTest
@ActiveProfiles("test")
class UserCreationEmailIntegrationTests {

    private static final String EMAIL = "credentials.email@example.test";

    @Autowired
    private WebApplicationContext context;

    @Autowired
    private UserRepository userRepository;

    @MockitoBean
    private EmailService emailService;
    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        userRepository.findByEmail(EMAIL).ifPresent(userRepository::delete);
    }

    @AfterEach
    void cleanUp() {
        userRepository.findByEmail(EMAIL).ifPresent(userRepository::delete);
    }

    @Test
    void sendsTemporaryCredentialsAfterCommit() throws Exception {
        mvc.perform(post("/api/users").with(user("admin").roles("ADMIN"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"firstName\":\"Ana\",\"firstLastName\":\"Prueba\",\"email\":\"" + EMAIL + "\","
                                + "\"password\":\"Temporal123!\",\"role\":\"ERGONOMIST\"}"))
                .andExpect(status().isCreated());
        verify(emailService, timeout(2000)).sendTemporaryCredentials(EMAIL, "Temporal123!");
    }

    @Test
    void doesNotSendCredentialsWhenCreationFails() throws Exception {
        mvc.perform(post("/api/users").with(user("admin").roles("ADMIN"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"firstName\":\"Ana\",\"firstLastName\":\"Prueba\",\"email\":\"" + EMAIL + "\","
                                + "\"password\":\"" + "ñ".repeat(37) + "\",\"role\":\"ERGONOMIST\"}"))
                .andExpect(status().isBadRequest());
        verify(emailService, never()).sendTemporaryCredentials(anyString(), anyString());
    }
}
