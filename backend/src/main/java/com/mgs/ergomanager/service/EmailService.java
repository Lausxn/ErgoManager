package com.mgs.ergomanager.service;

/**
 * Sends the application emails: user credentials and form invitations.
 */
public interface EmailService {

    /**
     * Sends the credentials assigned to a newly created user.
     *
     * @param recipientEmail   destination email address
     * @param temporaryPassword temporary password assigned to the user
     */
    void sendTemporaryCredentials(String recipientEmail, String temporaryPassword);

    /**
     * Invites an employee, or the contact person of a company, to answer a
     * self evaluation form.
     *
     * @param recipientEmail destination email address
     * @param companyName    business name of the company
     * @param formTitle      title of the form to answer
     * @param link           address of the self evaluation page
     */
    void sendFormInvitation(String recipientEmail, String companyName, String formTitle, String link);
}
