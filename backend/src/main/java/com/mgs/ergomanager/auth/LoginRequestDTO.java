package com.mgs.ergomanager.auth;

/**
 * Represents the credentials required to authenticate a user.
 */
public class LoginRequestDTO {

    private String email;
    private String password;

    public LoginRequestDTO() {
    }

    public LoginRequestDTO(String email, String password) {
        this.email = email;
        this.password = password;
    }

    /**
     * Gets the user's email.
     *
     * @return user's email
     */
    public String getEmail() {
        return email;
    }

    /**
     * Sets the user's email.
     *
     * @param email user's email
     */
    public void setEmail(String email) {
        this.email = email;
    }

    /**
     * Gets the user's password.
     *
     * @return user's password
     */
    public String getPassword() {
        return password;
    }

    /**
     * Sets the user's password.
     *
     * @param password user's password
     */
    public void setPassword(String password) {
        this.password = password;
    }
}
