package com.mgs.ergomanager.dto.company;

import java.time.LocalDateTime;

/**
 * Client company exposed by the API.
 *
 * @param id           identifier of the company
 * @param businessName legal name of the company
 * @param taxId        unique tax identifier
 * @param contactEmail email of the person in charge
 * @param phoneNumber  contact phone number
 * @param address      postal address
 * @param active       false when the company was deactivated
 * @param createdAt    moment the company was registered
 */
public record CompanyResponseDTO(
        Long id,
        String businessName,
        String taxId,
        String contactEmail,
        String phoneNumber,
        String address,
        boolean active,
        LocalDateTime createdAt) {
}
