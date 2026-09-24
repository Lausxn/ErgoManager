package com.mgs.ergomanager;

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

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class UserUpdateIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserRepository userRepository;

    private User user;

    @BeforeEach
    void setUp() {
        userRepository.deleteAll();

        user = new User();
        user.setFirstName("Carlos");
        user.setFirstLastName("Mora");
        user.setSecondLastName("Jimenez");
        user.setEmail("carlos@example.com");
        user.setPassword("$2a$10$abcdefghijklmnopqrstuv");
        user.setRole(Role.ERGONOMIST);
        user.setActive(true);

        user = userRepository.save(user);
    }

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

        mockMvc.perform(put("/api/users/{id}", user.getId())
                        .with(user("admin@example.com").roles("ADMIN"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestBody))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.firstName").value("Carlos Alberto"))
                .andExpect(jsonPath("$.email").value("carlos.actualizado@example.com"))
                .andExpect(jsonPath("$.role").value("ADMIN"));
    }
}