package com.mgs.ergomanager;

import com.jayway.jsonpath.JsonPath;
import com.mgs.ergomanager.model.User;
import com.mgs.ergomanager.model.enums.Role;
import com.mgs.ergomanager.repository.UserRepository;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;
import tools.jackson.databind.json.JsonMapper;

import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Checks GET /api/users, which the administrator dashboard uses to count the
 * active users, with real JWT security and an in memory database.
 */
@SpringBootTest
@ActiveProfiles("test")
class UserListIntegrationTests {

    private static final String PASSWORD = "Listing123!";

    @Autowired
    private WebApplicationContext context;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;
    private final JsonMapper jsonMapper = JsonMapper.builder().build();
    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        userRepository.deleteAll();
        createUser("admin@example.test", Role.ADMIN, true);
        createUser("ergonomist@example.test", Role.ERGONOMIST, true);
        createUser("inactive@example.test", Role.ERGONOMIST, false);
    }

    @Test
    void administratorReadsEveryUserWithItsStateAndWithoutPasswords() throws Exception {
        list(token("admin@example.test"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(3)))
                .andExpect(jsonPath("$[*].email").value(containsInAnyOrder(
                        "admin@example.test", "ergonomist@example.test", "inactive@example.test")))
                .andExpect(jsonPath("$[?(@.active == true)]", hasSize(2)))
                .andExpect(jsonPath("$[*].password").isEmpty())
                .andExpect(jsonPath("$[*].tokenVersion").isEmpty());
    }

    @Test
    void ergonomistCannotReadTheUsers() throws Exception {
        list(token("ergonomist@example.test")).andExpect(status().isForbidden());
    }

    @Test
    void anonymousRequestIsRejected() throws Exception {
        list(null).andExpect(status().isUnauthorized());
    }

    private ResultActions list(String token) throws Exception {
        var request = get("/api/users");
        if (token != null) {
            request.header("Authorization", "Bearer " + token);
        }
        return mockMvc.perform(request);
    }

    private String token(String email) throws Exception {
        String body = mockMvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content(jsonMapper.writeValueAsString(Map.of("email", email, "password", PASSWORD))))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return JsonPath.read(body, "$.token");
    }

    private void createUser(String email, Role role, boolean active) {
        User user = new User();
        user.setFirstName("Test");
        user.setFirstLastName("User");
        user.setEmail(email);
        user.setRole(role);
        user.setActive(active);
        user.setPassword(passwordEncoder.encode(PASSWORD));
        userRepository.saveAndFlush(user);
    }
}
