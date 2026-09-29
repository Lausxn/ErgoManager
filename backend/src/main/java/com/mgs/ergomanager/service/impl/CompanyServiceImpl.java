package com.mgs.ergomanager.service.impl;

import com.mgs.ergomanager.dto.company.CompanyRequestDTO;
import com.mgs.ergomanager.dto.company.CompanyResponseDTO;
import com.mgs.ergomanager.exception.DuplicateResourceException;
import com.mgs.ergomanager.exception.ResourceNotFoundException;
import com.mgs.ergomanager.model.Company;
import com.mgs.ergomanager.repository.CompanyRepository;
import com.mgs.ergomanager.service.CompanyService;
import java.util.List;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Default implementation of {@link CompanyService}.
 */
@Service
public class CompanyServiceImpl implements CompanyService {

    private static final String COMPANY_NOT_FOUND_MESSAGE = "No se encontró la empresa.";

    private static final String DUPLICATE_TAX_ID_MESSAGE = "Ya existe una empresa con esa cédula jurídica.";

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
    @Transactional(readOnly = true)
    public List<CompanyResponseDTO> findAll() {
        return companyRepository.findAllByOrderByBusinessNameAsc().stream()
                .map(CompanyServiceImpl::toResponse)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public CompanyResponseDTO findById(Long id) {
        return toResponse(getCompany(id));
    }

    @Override
    @Transactional
    public CompanyResponseDTO create(CompanyRequestDTO request) {
        if (companyRepository.existsByTaxId(request.taxId())) {
            throw new DuplicateResourceException(DUPLICATE_TAX_ID_MESSAGE);
        }
        Company company = new Company();
        copy(request, company);
        company.setActive(true);
        return toResponse(saveAndFlush(company));
    }

    @Override
    @Transactional
    public CompanyResponseDTO update(Long id, CompanyRequestDTO request) {
        Company company = getCompany(id);
        if (companyRepository.existsByTaxIdAndIdNot(request.taxId(), id)) {
            throw new DuplicateResourceException(DUPLICATE_TAX_ID_MESSAGE);
        }
        copy(request, company);
        return toResponse(saveAndFlush(company));
    }

    @Override
    @Transactional
    public void deactivate(Long id) {
        Company company = getCompany(id);
        company.setActive(false);
        companyRepository.save(company);
    }

    @Override
    @Transactional
    public CompanyResponseDTO activate(Long id) {
        Company company = getCompany(id);
        company.setActive(true);
        return toResponse(companyRepository.save(company));
    }

    /**
     * Reads a company or fails with HTTP 404.
     *
     * @param id identifier of the company
     * @return the stored company
     */
    private Company getCompany(Long id) {
        return companyRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException(COMPANY_NOT_FOUND_MESSAGE));
    }

    /**
     * Writes the company immediately, so a tax id taken by a concurrent request
     * is reported as a conflict instead of an unexpected error.
     *
     * @param company company to store
     * @return the stored company
     */
    private Company saveAndFlush(Company company) {
        try {
            return companyRepository.saveAndFlush(company);
        } catch (DataIntegrityViolationException exception) {
            throw new DuplicateResourceException(DUPLICATE_TAX_ID_MESSAGE);
        }
    }

    /**
     * Copies the already normalized request over a company.
     *
     * @param request data sent by the client
     * @param company entity to fill
     */
    private static void copy(CompanyRequestDTO request, Company company) {
        company.setBusinessName(request.businessName());
        company.setTaxId(request.taxId());
        company.setContactEmail(request.contactEmail());
        company.setPhoneNumber(request.phoneNumber());
        company.setAddress(request.address());
    }

    /**
     * Maps a company to the representation exposed by the API.
     *
     * @param company stored company
     * @return company response
     */
    static CompanyResponseDTO toResponse(Company company) {
        return new CompanyResponseDTO(
                company.getId(),
                company.getBusinessName(),
                company.getTaxId(),
                company.getContactEmail(),
                company.getPhoneNumber(),
                company.getAddress(),
                company.isActive(),
                company.getCreatedAt());
    }
}
