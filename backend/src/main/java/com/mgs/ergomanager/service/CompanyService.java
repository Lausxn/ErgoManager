package com.mgs.ergomanager.service;

import com.mgs.ergomanager.dto.company.CompanyRequest;
import com.mgs.ergomanager.dto.company.CompanyResponse;
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
    List<CompanyResponse> findAll();

    /**
     * Returns a single company.
     *
     * @param id identifier of the company
     * @return the company
     */
    CompanyResponse findById(Long id);

    /**
     * Registers a new company.
     *
     * @param request data of the company
     * @return the created company
     */
    CompanyResponse create(CompanyRequest request);

    /**
     * Updates the data of an existing company.
     *
     * @param id      identifier of the company
     * @param request new data of the company
     * @return the updated company
     */
    CompanyResponse update(Long id, CompanyRequest request);

    /**
     * Deactivates a company without deleting its evaluation history.
     *
     * @param id identifier of the company
     */
    void deactivate(Long id);
}
