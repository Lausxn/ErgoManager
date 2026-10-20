package com.mgs.ergomanager.dto.company;

import com.mgs.ergomanager.model.CompanyKeys;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.Locale;

/**
 * Data needed to create or update a client company.
 *
 * @param businessName legal name of the company
 * @param taxId        unique tax identifier, with the format 3-101-123456
 * @param contactEmail email of the person in charge
 * @param phoneNumber  contact phone number
 * @param address      postal address
 */
public record CompanyRequestDTO(

        @NotBlank(message = "Este campo es obligatorio.")
        @Size(max = 150, message = "Use un máximo de 150 caracteres.")
        String businessName,

        @NotBlank(message = "Este campo es obligatorio.")
        @Size(max = 20, message = "Use un máximo de 20 caracteres.")
        String taxId,

        @NotBlank(message = "Este campo es obligatorio.")
        @Email(message = "Escriba un correo válido.")
        @Size(max = 120, message = "Use un máximo de 120 caracteres.")
        String contactEmail,

        @Size(max = 30, message = "Use un máximo de 30 caracteres.")
        String phoneNumber,

        @Size(max = 200, message = "Use un máximo de 200 caracteres.")
        String address) {

    /**
     * Trims the values, leaves single spaces between the words of the business
     * name, adds the dashes of a ten digit tax id, lowercases the email and
     * turns blank optional fields into null.
     */
    public CompanyRequestDTO {
        businessName = CompanyKeys.cleanBusinessName(businessName);
        taxId = CompanyKeys.cleanTaxId(taxId);
        contactEmail = contactEmail == null ? null : contactEmail.trim().toLowerCase(Locale.ROOT);
        phoneNumber = phoneNumber == null || phoneNumber.isBlank() ? null : phoneNumber.trim();
        address = address == null || address.isBlank() ? null : address.trim();
    }
}
