package com.mgs.ergomanager.config;

import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

/**
 * Allows the Angular application, served from a different port, to call the
 * REST API. The allowed origins are configured in application.properties.
 */
@Configuration
public class CorsConfig {

    private static final String API_PATH_PATTERN = "/api/**";

    private static final List<String> ALLOWED_METHODS = List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS");

    private static final long MAX_AGE_SECONDS = 3600L;

    private final List<String> allowedOrigins;

    /**
     * Builds the configuration with the origins allowed to call the API.
     *
     * @param allowedOrigins comma separated list of origins
     */
    public CorsConfig(@Value("${ergomanager.cors.allowed-origins}") List<String> allowedOrigins) {
        this.allowedOrigins = allowedOrigins;
    }

    /**
     * Declares the CORS rules applied to the API endpoints.
     *
     * @return source consumed by the Spring Security filter chain
     */
    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOrigins(allowedOrigins);
        configuration.setAllowedMethods(ALLOWED_METHODS);
        configuration.setAllowedHeaders(List.of(CorsConfiguration.ALL));
        configuration.setAllowCredentials(true);
        configuration.setMaxAge(MAX_AGE_SECONDS);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration(API_PATH_PATTERN, configuration);
        return source;
    }
}
