package com.mgs.ergomanager;

import org.junit.jupiter.api.Test;
import com.mgs.ergomanager.config.ErgonomistInitializer;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationContext;
import static org.assertj.core.api.Assertions.assertThat;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

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
        assertThat(context.getBeansOfType(ErgonomistInitializer.class)).isEmpty();
    }
}
