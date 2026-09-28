package com.mgs.ergomanager.event;

import com.mgs.ergomanager.service.EmailService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * Sends the temporary credentials after the user creation transaction commits.
 */
@Component
public class UserCreatedEmailListener {

    private static final Logger LOGGER =
            LoggerFactory.getLogger(UserCreatedEmailListener.class);

    private final EmailService emailService;

    /**
     * Builds the listener with its email collaborator.
     *
     * @param emailService service used to send user credentials
     */
    public UserCreatedEmailListener(EmailService emailService) {
        this.emailService = emailService;
    }

    /**
     * Sends the credentials only after the database transaction commits.
     *
     * @param event created user data required by the email
     */
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void handleUserCreated(UserCreatedEvent event) {
        try {
            emailService.sendTemporaryCredentials(
                    event.email(),
                    event.temporaryPassword());
        } catch (Exception exception) {
            LOGGER.error(
                    "No se pudo enviar el correo de credenciales al usuario {}",
                    event.email(),
                    exception);
        }
    }
}