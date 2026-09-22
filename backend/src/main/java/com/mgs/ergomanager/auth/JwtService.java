package com.mgs.ergomanager.auth;

import java.nio.charset.StandardCharsets;
import java.util.Date;

import javax.crypto.SecretKey;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;

/**
 * Provides operations for generating and validating JWT authentication tokens.
 */
@Service
public class JwtService {

    private final SecretKey secretKey;
    private final long tokenExpirationTime;

    /**
     * Creates the JWT service using the configured secret and expiration time.
     *
     * @param jwtSecret secret used to sign JWTs
     * @param tokenExpirationTime token expiration time in milliseconds
     */
    public JwtService(
            @Value("${jwt.secret}") String jwtSecret,
            @Value("${jwt.expiration}") long tokenExpirationTime) {

        this.secretKey = Keys.hmacShaKeyFor(
                jwtSecret.getBytes(StandardCharsets.UTF_8));
        this.tokenExpirationTime = tokenExpirationTime;
    }

    /**
     * Generates a JWT for an authenticated user.
     *
     * @param email authenticated user's email
     * @param role authenticated user's role
     * @return generated JWT
     */
    public String generateToken(String email, String role) {
        Date currentDate = new Date();
        Date expirationDate = new Date(
                currentDate.getTime() + tokenExpirationTime);

        return Jwts.builder()
                .subject(email)
                .claim("role", role)
                .issuedAt(currentDate)
                .expiration(expirationDate)
                .signWith(secretKey)
                .compact();
    }

    /**
     * Extracts the user's email from a JWT.
     *
     * @param token JWT to read
     * @return user's email
     */
    public String extractEmail(String token) {
        return extractClaims(token).getSubject();
    }

    /**
     * Extracts the user's role from a JWT.
     *
     * @param token JWT to read
     * @return user's role
     */
    public String extractRole(String token) {
        return extractClaims(token).get("role", String.class);
    }

    /**
     * Determines whether a JWT is valid.
     *
     * @param token JWT to validate
     * @return true when the token is valid; false otherwise
     */
    public boolean isTokenValid(String token) {
        try {
            extractClaims(token);
            return true;
        } catch (Exception exception) {
            return false;
        }
    }

    /**
     * Extracts all claims after verifying the JWT signature.
     *
     * @param token JWT to read
     * @return token claims
     */
    private Claims extractClaims(String token) {
        return Jwts.parser()
                .verifyWith(secretKey)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }
}