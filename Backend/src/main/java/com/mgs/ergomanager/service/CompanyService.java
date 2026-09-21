package com.mgs.ergomanager.service;

import com.mgs.ergomanager.dto.company.CompanyRequestDTO;
import com.mgs.ergomanager.dto.company.CompanyResponseDTO;
import java.util.List;

/**
 * Management of the client companies of MGS.
 */
public interface CompanyService {

    /**
     * Returns every registered company.
     *
     * @return list of companies
     */
    List<CompanyResponseDTO> findAll();

    /**
     * Returns a single company.
     *
     * @param id identifier of the company
     * @return the company
     */
    CompanyResponseDTO findById(Long id);

    /**
     * Registers a new company.
     *
     * @param request data of the company
     * @return the created company
     */
    CompanyResponseDTO create(CompanyRequestDTO request);

    /**
     * Updates the data of an existing company.
     *
     * @param id      identifier of the company
     * @param request new data of the company
     * @return the updated company
     */
    CompanyResponseDTO update(Long id, CompanyRequestDTO request);

    /**
     * Deactivates a company without deleting its evaluation history.
     *
     * @param id identifier of the company
     */
    void deactivate(Long id);
}
