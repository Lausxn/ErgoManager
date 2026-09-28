package com.mgs.ergomanager;

import com.mgs.ergomanager.config.ErgonomistInitializer;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContext;
import org.springframework.test.context.ActiveProfiles;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Checks that the Spring context starts with every bean of the application.
 */
@SpringBootTest
@ActiveProfiles("test")
class ErgoManagerApplicationTests {

    @Autowired
    private ApplicationContext context;

    /**
     * Fails when a bean cannot be created or a property is missing.
     */
    @Test
    void contextLoads() {
        // Successful startup verifies that the application context can be created.
    }

    /** Checks that normal startup does not enable account provisioning. */
    @Test
    void initializerIsDisabledByDefault() {
        assertThat(context.getBeansOfType(ErgonomistInitializer.class)).isEmpty();
    }
}
