package com.mgs.ergomanager.service;

/**
 * Sends application emails related to user account management.
 */
public interface EmailService {

    /**
     * Sends the credentials assigned to a newly created user.
     *
     * @param recipientEmail   destination email address
     * @param temporaryPassword temporary password assigned to the user
     */
    void sendTemporaryCredentials(String recipientEmail, String temporaryPassword);
}