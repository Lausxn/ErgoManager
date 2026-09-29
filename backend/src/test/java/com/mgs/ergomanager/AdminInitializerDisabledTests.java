package com.mgs.ergomanager;

import com.mgs.ergomanager.config.AdminInitializer;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContext;
import org.springframework.test.context.ActiveProfiles;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Verifies that the initial administrator is opt-in: without explicit
 * configuration the initializer is not registered and nothing is created.
 */
@SpringBootTest
@ActiveProfiles("test")
class AdminInitializerDisabledTests {

    @Autowired
    private ApplicationContext context;

    @Test
    void initializerIsDisabledByDefault() {
        assertThat(context.getBeansOfType(AdminInitializer.class)).isEmpty();
    }
}
