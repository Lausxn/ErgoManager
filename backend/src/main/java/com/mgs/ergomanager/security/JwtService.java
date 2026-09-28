package com.mgs.ergomanager.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import javax.crypto.SecretKey;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Service;

/**
 * Creates and reads the JSON Web Tokens used to authenticate every request.
 */
@Service
public class JwtService {

    private static final String ROLE_CLAIM = "role";

    private static final String VERSION_CLAIM = "tokenVersion";

    private final SecretKey signingKey;

    private final long expirationMs;

    /**
     * Builds the service from the values configured in application.properties.
     *
     * @param secret       secret used to sign the tokens, at least 32 characters
     * @param expirationMs lifetime of a token in milliseconds
     */
    public JwtService(@Value("${ergomanager.security.jwt.secret}") String secret,
                      @Value("${ergomanager.security.jwt.expiration-ms}") long expirationMs) {
        this.signingKey = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.expirationMs = expirationMs;
    }

    /**
     * Generates a signed token for an authenticated user.
     *
     * @param email email used as subject of the token
     * @param role  role stored as an extra claim
     * @param tokenVersion persisted session version of the user
     * @return compact representation of the token
     */
    public String generateToken(String email, String role, long tokenVersion) {
        Date issuedAt = new Date();
        Date expiration = new Date(issuedAt.getTime() + expirationMs);
        return Jwts.builder()
                .subject(email)
                .claim(ROLE_CLAIM, role)
                .claim(VERSION_CLAIM, tokenVersion)
                .issuedAt(issuedAt)
                .expiration(expiration)
                .signWith(signingKey)
                .compact();
    }

    /**
     * Reads the email stored as the subject of a token.
     *
     * @param token compact representation of the token
     * @return email of the user the token belongs to
     */
    public String extractEmail(String token) {
        return extractClaims(token).getSubject();
    }

    /**
     * Reads the role stored in a token.
     *
     * @param token compact representation of the token
     * @return role granted to the user
     */
    public String extractRole(String token) {
        return extractClaims(token).get(ROLE_CLAIM, String.class);
    }

    /**
     * Checks that a token is well signed, not expired and issued for the given
     * user.
     *
     * @param token       compact representation of the token
     * @param userDetails user loaded from the database
     * @return true when the token can be trusted
     */
    public boolean isTokenValid(String token, UserDetails userDetails) {
        Claims claims = extractClaims(token);
        boolean sameUser = claims.getSubject().equals(userDetails.getUsername());
        Number version = claims.get(VERSION_CLAIM, Number.class);
        // Tokens from Task 77 remain valid only until the first password change.
        long tokenVersion = version == null ? 0 : version.longValue();
        return sameUser && userDetails.isEnabled()
                && userDetails instanceof UserPrincipal principal
                && tokenVersion == principal.getTokenVersion()
                && claims.getExpiration().after(new Date());
    }

    /**
     * Returns the lifetime configured for the generated tokens.
     *
     * @return lifetime in milliseconds
     */
    public long getExpirationMs() {
        return expirationMs;
    }

    /**
     * Parses a token and returns its claims, failing when the signature or the
     * expiration are not valid.
     *
     * @param token compact representation of the token
     * @return claims contained in the token
     */
    private Claims extractClaims(String token) {
        return Jwts.parser()
                .verifyWith(signingKey)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }
}
