package com.mgs.ergomanager.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Publishes the API documentation at /swagger-ui.html, with a button to send
 * the JWT on the protected endpoints.
 */
@Configuration
public class OpenApiConfig {

    private static final String SECURITY_SCHEME_NAME = "bearerAuth";

    /**
     * Declares the OpenAPI document exposed by springdoc.
     *
     * @return document describing the API and its authentication scheme
     */
    @Bean
    public OpenAPI ergoManagerOpenApi() {
        SecurityScheme bearerScheme = new SecurityScheme()
                .name(SECURITY_SCHEME_NAME)
                .type(SecurityScheme.Type.HTTP)
                .scheme("bearer")
                .bearerFormat("JWT");

        return new OpenAPI()
                .info(new Info()
                        .title("ErgoManager API")
                        .description("Ergonomic management system for the client companies of MGS")
                        .version("v1")
                        .contact(new Contact().name("MGS")))
                .addSecurityItem(new SecurityRequirement().addList(SECURITY_SCHEME_NAME))
                .components(new Components().addSecuritySchemes(SECURITY_SCHEME_NAME, bearerScheme));
    }
}
