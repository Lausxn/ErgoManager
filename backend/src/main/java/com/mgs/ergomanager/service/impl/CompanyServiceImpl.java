package com.mgs.ergomanager.service.impl;

import com.mgs.ergomanager.dto.company.CompanyRequest;
import com.mgs.ergomanager.dto.company.CompanyResponse;
import com.mgs.ergomanager.repository.CompanyRepository;
import com.mgs.ergomanager.service.CompanyService;
import java.util.List;
import org.springframework.stereotype.Service;

/**
 * Default implementation of {@link CompanyService}.
 */
@Service
public class CompanyServiceImpl implements CompanyService {

    private final CompanyRepository companyRepository;

    /**
     * Builds the service with its repository.
     *
     * @param companyRepository repository of client companies
     */
    public CompanyServiceImpl(CompanyRepository companyRepository) {
        this.companyRepository = companyRepository;
    }

    @Override
    public List<CompanyResponse> findAll() {
        // TODO: read every company and map it to CompanyResponse.
        throw new UnsupportedOperationException("CompanyService.findAll is not implemented yet");
    }

    @Override
    public CompanyResponse findById(Long id) {
        // TODO: read the company or raise ResourceNotFoundException.
        throw new UnsupportedOperationException("CompanyService.findById is not implemented yet");
    }

    @Override
    public CompanyResponse create(CompanyRequest request) {
        // TODO: reject a duplicated tax id and store the new company.
        throw new UnsupportedOperationException("CompanyService.create is not implemented yet");
    }

    @Override
    public CompanyResponse update(Long id, CompanyRequest request) {
        // TODO: copy the request over the stored company.
        throw new UnsupportedOperationException("CompanyService.update is not implemented yet");
    }

    @Override
    public void deactivate(Long id) {
        // TODO: set the active flag to false, never delete the row.
        throw new UnsupportedOperationException("CompanyService.deactivate is not implemented yet");
    }
}
