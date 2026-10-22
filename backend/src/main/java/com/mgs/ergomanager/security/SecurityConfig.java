package com.mgs.ergomanager.security;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AccountStatusUserDetailsChecker;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.ProviderManager;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

/**
 * Stateless security setup: every request is authenticated with a JWT, and the
 * access to each group of endpoints is restricted by role.
 */
@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class SecurityConfig {

    private static final String[] PUBLIC_ENDPOINTS = {
            "/api/auth/login",
            "/v3/api-docs/**",
            "/swagger-ui/**",
            "/swagger-ui.html"
    };

    private final JwtAuthenticationFilter jwtAuthenticationFilter;
    private final CustomUserDetailsService userDetailsService;
    private final RestSecurityErrorHandler securityErrorHandler;

    /**
     * Builds the configuration with the JWT collaborators.
     *
     * @param jwtAuthenticationFilter filter that reads the Authorization header
     * @param userDetailsService      service that loads the users
     * @param securityErrorHandler    writer of the 401 and 403 error payloads
     */
    public SecurityConfig(JwtAuthenticationFilter jwtAuthenticationFilter,
                          CustomUserDetailsService userDetailsService,
                          RestSecurityErrorHandler securityErrorHandler) {
        this.jwtAuthenticationFilter = jwtAuthenticationFilter;
        this.userDetailsService = userDetailsService;
        this.securityErrorHandler = securityErrorHandler;
    }

    /**
     * Declares the filter chain applied to every request.
     *
     * @param http builder provided by Spring Security
     * @return configured filter chain
     * @throws Exception when the chain cannot be built
     */
    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                .csrf(csrf -> csrf.disable())
                .cors(Customizer.withDefaults())
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .exceptionHandling(handling -> handling
                        .authenticationEntryPoint(securityErrorHandler)
                        .accessDeniedHandler(securityErrorHandler))
                .authorizeHttpRequests(requests -> requests
                        .requestMatchers(PUBLIC_ENDPOINTS).permitAll()
                        // Employees answer the form without an account.
                        .requestMatchers(HttpMethod.GET, "/api/forms/active").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/self-evaluations").permitAll()
                        // Administrators and ergonomists have full access to companies and forms;
                        // user management stays restricted to administrators.
                        .requestMatchers("/api/companies/**").hasAnyRole("ADMIN", "ERGONOMIST")
                        .requestMatchers("/api/users/**").hasRole("ADMIN")
                        .requestMatchers("/api/forms/**").hasAnyRole("ADMIN", "ERGONOMIST")
                        .requestMatchers("/api/dashboard/**").hasRole("ADMIN")
                        // Only ergonomists write evaluations and list their own; admins can read
                        // a single evaluation and its report. Ownership is checked by the service.
                        .requestMatchers(HttpMethod.POST, "/api/personalized-evaluations").hasRole("ERGONOMIST")
                        .requestMatchers(HttpMethod.GET, "/api/personalized-evaluations").hasRole("ERGONOMIST")
                        .requestMatchers(HttpMethod.GET, "/api/personalized-evaluations/*",
                                "/api/personalized-evaluations/*/report").hasAnyRole("ADMIN", "ERGONOMIST")
                        .requestMatchers("/api/personalized-evaluations/**").hasRole("ERGONOMIST")
                        // Both roles; ownership of the agenda is checked by the services.
                        .requestMatchers("/api/appointments/**").authenticated()
                        .requestMatchers("/api/histories/**").authenticated()
                        .requestMatchers(HttpMethod.GET, "/api/self-evaluations/**").authenticated()
                        .anyRequest().authenticated())
                .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }

    /**
     * Declares the authentication manager used by the sign in endpoint.
     *
     * @param passwordEncoder encoder that validates the stored hashes
     * @return manager backed by the database users
     */
    @Bean
    public AuthenticationManager authenticationManager(PasswordEncoder passwordEncoder) {
        DaoAuthenticationProvider provider = new DaoAuthenticationProvider(userDetailsService);
        provider.setPasswordEncoder(passwordEncoder);
        // Check the password before the account state, so a wrong password never
        // reveals that an account exists and is deactivated.
        provider.setPreAuthenticationChecks(user -> { });
        provider.setPostAuthenticationChecks(new AccountStatusUserDetailsChecker());
        return new ProviderManager(provider);
    }

    /**
     * Declares the algorithm used to hash the passwords.
     *
     * @return BCrypt based encoder
     */
    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
