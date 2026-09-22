package com.mgs.ergomanager.auth;

/**
 * Represents the response returned after a successful authentication.
 */
public class LoginResponseDTO {

    private String token;
    private String role;

    public LoginResponseDTO() {
    }

    public LoginResponseDTO(String token, String role) {
        this.token = token;
        this.role = role;
    }

    /**
     * Gets the authentication token.
     *
     * @return authentication token
     */
    public String getToken() {
        return token;
    }

    /**
     * Sets the authentication token.
     *
     * @param token authentication token
     */
    public void setToken(String token) {
        this.token = token;
    }

    /**
     * Gets the authenticated user's role.
     *
     * @return user's role
     */
    public String getRole() {
        return role;
    }

    /**
     * Sets the authenticated user's role.
     *
     * @param role user's role
     */
    public void setRole(String role) {
        this.role = role;
    }
}