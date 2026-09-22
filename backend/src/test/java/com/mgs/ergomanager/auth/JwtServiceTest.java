package com.mgs.ergomanager.auth;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

/**
 * Tests the JWT generation and validation operations.
 */
public class JwtServiceTest {

    private static final String TEST_SECRET =
            "ErgoManagerJwtSecretKey2026BrandonTask77Secure";

    private static final long TEST_EXPIRATION_TIME = 3600000;

    /**
     * Verifies that a generated token contains the expected user information.
     */
    @Test
    public void generateAndValidateToken() {
        JwtService jwtService =
                new JwtService(TEST_SECRET, TEST_EXPIRATION_TIME);

        String email = "test@ergomanager.com";
        String role = "Administrador";

        String token = jwtService.generateToken(email, role);

        assertTrue(jwtService.isTokenValid(token));
        assertEquals(email, jwtService.extractEmail(token));
        assertEquals(role, jwtService.extractRole(token));
    }
}