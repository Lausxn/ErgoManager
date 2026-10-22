package com.mgs.ergomanager.service.impl;

import com.mgs.ergomanager.service.EmailService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

/**
 * Default implementation of {@link EmailService}.
 */
@Service
public class EmailServiceImpl implements EmailService {

    private final JavaMailSender mailSender;
    private final String senderEmail;

    /**
     * Builds the email service with its collaborators.
     *
     * @param mailSender  Spring mail sender
     * @param senderEmail email address used as sender
     */
    public EmailServiceImpl(
            JavaMailSender mailSender,
            @Value("${spring.mail.username:}") String senderEmail) {
        this.mailSender = mailSender;
        this.senderEmail = senderEmail;
    }

    /**
     * Sends the credentials assigned to a newly created user.
     *
     * @param recipientEmail    destination email address
     * @param temporaryPassword temporary password assigned to the user
     */
    @Override
    public void sendTemporaryCredentials(String recipientEmail, String temporaryPassword) {
        SimpleMailMessage message = new SimpleMailMessage();

        if (!senderEmail.isBlank()) {
            message.setFrom(senderEmail);
        }

        message.setTo(recipientEmail);
        message.setSubject("Credenciales de acceso - ErgoManager");

        message.setText(
                "Se ha creado una cuenta para usted en ErgoManager.\n\n"
                        + "Usuario: " + recipientEmail + "\n"
                        + "Contraseña temporal: " + temporaryPassword + "\n\n"
                        + "Por seguridad, cambie su contraseña después de iniciar sesión.");

        mailSender.send(message);
    }

    /**
     * Invites a recipient to answer a self evaluation form.
     *
     * @param recipientEmail destination email address
     * @param companyName    business name of the company
     * @param formTitle      title of the form to answer
     * @param link           address of the self evaluation page
     */
    @Override
    public void sendFormInvitation(String recipientEmail, String companyName, String formTitle, String link) {
        SimpleMailMessage message = new SimpleMailMessage();

        if (!senderEmail.isBlank()) {
            message.setFrom(senderEmail);
        }

        message.setTo(recipientEmail);
        message.setSubject("Autoevaluación ergonómica - " + companyName);

        message.setText(
                "Hola:\n\n"
                        + "MGS le invita a completar la autoevaluación ergonómica \"" + formTitle + "\""
                        + " para " + companyName + ".\n\n"
                        + "Ingrese al siguiente enlace para responderla:\n" + link + "\n\n"
                        + "Gracias por su colaboración.");

        mailSender.send(message);
    }
}
