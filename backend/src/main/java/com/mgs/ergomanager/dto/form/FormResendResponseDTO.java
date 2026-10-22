package com.mgs.ergomanager.dto.form;

/**
 * Result of resending a form to the employees of a company.
 *
 * @param recipientCount number of emails that were sent successfully
 */
public record FormResendResponseDTO(int recipientCount) {
}
