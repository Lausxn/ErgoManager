package com.mgs.ergomanager.service.impl;

import com.mgs.ergomanager.dto.company.CompanyRequestDTO;
import com.mgs.ergomanager.dto.company.CompanyResponseDTO;
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
    public List<CompanyResponseDTO> findAll() {
        // TODO: read every company and map it to CompanyResponseDTO.
        throw new UnsupportedOperationException("CompanyService.findAll is not implemented yet");
    }

    @Override
    public CompanyResponseDTO findById(Long id) {
        // TODO: read the company or raise ResourceNotFoundException.
        throw new UnsupportedOperationException("CompanyService.findById is not implemented yet");
    }

    @Override
    public CompanyResponseDTO create(CompanyRequestDTO request) {
        // TODO: reject a duplicated tax id and store the new company.
        throw new UnsupportedOperationException("CompanyService.create is not implemented yet");
    }

    @Override
    public CompanyResponseDTO update(Long id, CompanyRequestDTO request) {
        // TODO: copy the request over the stored company.
        throw new UnsupportedOperationException("CompanyService.update is not implemented yet");
    }

    @Override
    public void deactivate(Long id) {
        // TODO: set the active flag to false, never delete the row.
        throw new UnsupportedOperationException("CompanyService.deactivate is not implemented yet");
    }
}
