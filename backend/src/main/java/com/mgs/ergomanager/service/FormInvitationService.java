package com.mgs.ergomanager.service;

import com.mgs.ergomanager.dto.form.FormResendResponseDTO;

/**
 * Email invitations to answer a self evaluation form.
 */
public interface FormInvitationService {

    /**
     * Sends a form again to the employees of a company, which is the yearly
     * follow up required by MGS.
     *
     * @param formId    identifier of the form to resend
     * @param companyId identifier of the company to notify
     * @return number of emails sent successfully
     */
    FormResendResponseDTO resendAnnually(Long formId, Long companyId);
}
