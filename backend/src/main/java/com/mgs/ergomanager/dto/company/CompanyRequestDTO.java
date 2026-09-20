package com.mgs.ergomanager.dto.company;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Data needed to create or update a client company.
 *
 * @param businessName legal name of the company
 * @param taxId        unique tax identifier
 * @param contactEmail email of the person in charge
 * @param phoneNumber  contact phone number
 * @param address      postal address
 */
public record CompanyRequestDTO(

        @NotBlank
        @Size(max = 150)
        String businessName,

        @NotBlank
        @Size(max = 20)
        String taxId,

        @NotBlank
        @Email
        @Size(max = 120)
        String contactEmail,

        @Size(max = 30)
        String phoneNumber,

        @Size(max = 200)
        String address) {
}
