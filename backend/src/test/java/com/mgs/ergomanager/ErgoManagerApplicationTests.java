package com.mgs.ergomanager;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

/**
 * Checks that the Spring context starts with every bean of the application.
 */
@SpringBootTest
@ActiveProfiles("test")
class ErgoManagerApplicationTests {

    /**
     * Fails when a bean cannot be created or a property is missing.
     */
    @Test
    void contextLoads() {
        // The assertion is the successful start up of the context.
    }
}
