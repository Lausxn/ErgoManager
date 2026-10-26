package com.mgs.ergomanager.service.impl;

import com.mgs.ergomanager.dto.form.FormResendResponseDTO;
import com.mgs.ergomanager.exception.BusinessException;
import com.mgs.ergomanager.exception.ResourceNotFoundException;
import com.mgs.ergomanager.model.Company;
import com.mgs.ergomanager.model.Form;
import com.mgs.ergomanager.model.enums.FormType;
import com.mgs.ergomanager.repository.CompanyRepository;
import com.mgs.ergomanager.repository.FormRepository;
import com.mgs.ergomanager.repository.SelfEvaluationRepository;
import com.mgs.ergomanager.service.EmailService;
import com.mgs.ergomanager.service.FormInvitationService;
import java.util.LinkedHashSet;
import java.util.Locale;
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * Default implementation of {@link FormInvitationService}.
 */
@Service
public class FormInvitationServiceImpl implements FormInvitationService {

    private static final Logger LOGGER = LoggerFactory.getLogger(FormInvitationServiceImpl.class);
    private final FormRepository formRepository;
    private final CompanyRepository companyRepository;
    private final SelfEvaluationRepository selfEvaluationRepository;
    private final EmailService emailService;
    private final String frontendUrl;

    /**
     * Builds the service with its collaborators.
     *
     * @param formRepository           repository of forms
     * @param companyRepository        repository of client companies
     * @param selfEvaluationRepository repository of self evaluations, source of the employee emails
     * @param emailService             service that sends the invitations
     * @param frontendUrl              base URL of the Angular application
     */
    public FormInvitationServiceImpl(FormRepository formRepository, CompanyRepository companyRepository,
                                     SelfEvaluationRepository selfEvaluationRepository, EmailService emailService,
                                     @Value("${ergomanager.frontend-url}") String frontendUrl) {
        this.formRepository = formRepository;
        this.companyRepository = companyRepository;
        this.selfEvaluationRepository = selfEvaluationRepository;
        this.emailService = emailService;
        this.frontendUrl = frontendUrl.endsWith("/") ? frontendUrl.substring(0, frontendUrl.length() - 1) : frontendUrl;
    }

    /**
     * Sends the invitation to the contact of the company and to every employee
     * that already answered a self evaluation for it. It runs without a
     * transaction on purpose, so no database connection is held while the
     * emails are sent. A failed recipient is logged and does not stop the rest.
     */
    @Override
    public FormResendResponseDTO resendAnnually(Long formId, Long companyId) {
        Form form = formRepository.findById(formId)
                .orElseThrow(() -> new ResourceNotFoundException("No se encontró el formulario."));
        Company company = companyRepository.findById(companyId)
                .orElseThrow(() -> new ResourceNotFoundException("No se encontró la empresa."));
        if (form.getType() != FormType.SELF_EVALUATION) {
            throw new BusinessException("Solo las autoevaluaciones se reenvían a las empresas.");
        }
        if (!form.isActive()) {
            throw new BusinessException("El formulario está inactivo. Actívelo antes de reenviarlo.");
        }
        if (!company.isActive()) {
            throw new BusinessException("La empresa está inactiva. Actívela antes de reenviar el formulario.");
        }

        // Normalized again because rows stored before the DTOs normalized emails may differ in case or spaces.
        Set<String> recipients = new LinkedHashSet<>();
        recipients.add(company.getContactEmail().trim().toLowerCase(Locale.ROOT));
        for (String email : selfEvaluationRepository.findDistinctEmployeeEmailsByCompanyId(companyId)) {
            recipients.add(email.trim().toLowerCase(Locale.ROOT));
        }

        String link = frontendUrl + "/self-evaluation?companyId=" + companyId;
        int sent = 0;
        for (String recipient : recipients) {
            try {
                emailService.sendFormInvitation(recipient, company.getBusinessName(), form.getTitle(), link);
                sent++;
            } catch (Exception exception) {
                LOGGER.error("No se pudo enviar el formulario {} al destinatario {}", formId, recipient, exception);
            }
        }
        LOGGER.info("Formulario {} reenviado a la empresa {}: {} de {} correos enviados",
                formId, companyId, sent, recipients.size());
        return new FormResendResponseDTO(sent);
    }
}
