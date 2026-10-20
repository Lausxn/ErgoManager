package com.mgs.ergomanager.service.impl;

import com.mgs.ergomanager.dto.company.CompanyRequestDTO;
import com.mgs.ergomanager.dto.company.CompanyResponseDTO;
import com.mgs.ergomanager.exception.DuplicateResourceException;
import com.mgs.ergomanager.exception.FieldValidationException;
import com.mgs.ergomanager.exception.ResourceNotFoundException;
import com.mgs.ergomanager.model.Company;
import com.mgs.ergomanager.model.CompanyKeys;
import com.mgs.ergomanager.repository.CompanyRepository;
import com.mgs.ergomanager.service.CompanyService;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Pattern;
import org.hibernate.exception.ConstraintViolationException;
import org.hibernate.exception.ConstraintViolationException.ConstraintKind;
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
    private static final String DUPLICATE_NAME_MESSAGE = "Ya existe una empresa con ese nombre.";
    private static final Pattern BUSINESS_NAME_FORMAT = Pattern.compile("[\\p{L}\\p{N}]");
    private static final Pattern TAX_ID_FORMAT = Pattern.compile("\\d-\\d{3}-\\d{6}");
    private static final Pattern PHONE_NUMBER_FORMAT = Pattern.compile("\\+?(?:[ ()-]*\\d){8,15}[ ()-]*");
    private static final String BUSINESS_NAME_FORMAT_MESSAGE = "La razón social debe incluir letras o números.";
    private static final String TAX_ID_FORMAT_MESSAGE = "Escriba la cédula jurídica con el formato 3-101-123456.";
    private static final String PHONE_NUMBER_FORMAT_MESSAGE =
            "Escriba un teléfono válido de 8 a 15 dígitos, por ejemplo 2222-3333.";
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
        checkFormats(request, null);
        checkBusinessNameIsFree(CompanyKeys.businessNameKey(request.businessName()));
        checkTaxIdIsFree(CompanyKeys.taxIdKey(request.taxId()));
        Company company = new Company();
        copy(request, company);
        company.setActive(true);
        return toResponse(saveAndFlush(company));
    }

    @Override
    @Transactional
    public CompanyResponseDTO update(Long id, CompanyRequestDTO request) {
        Company company = getCompany(id);
        checkFormats(request, company);
        // Only a value that changes can collide with another company, so an
        // edit that keeps the name and the tax id needs no extra query.
        String businessNameKey = CompanyKeys.businessNameKey(request.businessName());
        if (!businessNameKey.equals(company.getBusinessNameKey())) {
            checkBusinessNameIsFree(businessNameKey);
        }
        String taxIdKey = CompanyKeys.taxIdKey(request.taxId());
        if (!taxIdKey.equals(company.getTaxIdKey())) {
            checkTaxIdIsFree(taxIdKey);
        }
        copy(request, company);
        return toResponse(saveAndFlush(company));
    }

    @Override
    @Transactional
    public void deactivate(Long id) {
        // The entity is managed, so the change is written when the transaction ends.
        getCompany(id).setActive(false);
    }

    @Override
    @Transactional
    public CompanyResponseDTO activate(Long id) {
        Company company = getCompany(id);
        company.setActive(true);
        return toResponse(company);
    }

    /**
     * Checks the formats of the business name, the tax id and the phone number.
     * When editing, a value that did not change is not checked, so a company
     * registered before these formats existed can still be edited; it only has
     * to follow them once that value changes.
     *
     * @param request data sent by the client, already normalized
     * @param stored  company being edited, or null when creating one
     */
    private static void checkFormats(CompanyRequestDTO request, Company stored) {
        Map<String, String> fieldErrors = new LinkedHashMap<>();
        if (changed(request.businessName(), stored == null ? null : stored.getBusinessName(), stored)
                && !BUSINESS_NAME_FORMAT.matcher(request.businessName()).find()) {
            fieldErrors.put("businessName", BUSINESS_NAME_FORMAT_MESSAGE);
        }
        if (changed(request.taxId(), stored == null ? null : stored.getTaxId(), stored)
                && !TAX_ID_FORMAT.matcher(request.taxId()).matches()) {
            fieldErrors.put("taxId", TAX_ID_FORMAT_MESSAGE);
        }
        if (request.phoneNumber() != null
                && changed(request.phoneNumber(), stored == null ? null : stored.getPhoneNumber(), stored)
                && !PHONE_NUMBER_FORMAT.matcher(request.phoneNumber()).matches()) {
            fieldErrors.put("phoneNumber", PHONE_NUMBER_FORMAT_MESSAGE);
        }
        if (!fieldErrors.isEmpty()) {
            throw new FieldValidationException(fieldErrors);
        }
    }

    /**
     * Tells whether a value is new: always when creating, and when editing only
     * if it differs from the stored one.
     *
     * @param value       value sent by the client
     * @param storedValue value stored in the company
     * @param stored      company being edited, or null when creating one
     * @return true when the value must be checked
     */
    private static boolean changed(String value, String storedValue, Company stored) {
        return stored == null || !value.equals(storedValue);
    }

    /**
     * Fails with HTTP 409 when another company already uses the business name.
     *
     * @param businessNameKey comparison key of the name
     */
    private void checkBusinessNameIsFree(String businessNameKey) {
        if (companyRepository.existsByBusinessNameKey(businessNameKey)) {
            throw new DuplicateResourceException(DUPLICATE_NAME_MESSAGE);
        }
    }

    /**
     * Fails with HTTP 409 when another company already uses the tax id.
     *
     * @param taxIdKey comparison key of the tax id
     */
    private void checkTaxIdIsFree(String taxIdKey) {
        if (companyRepository.existsByTaxIdKey(taxIdKey)) {
            throw new DuplicateResourceException(DUPLICATE_TAX_ID_MESSAGE);
        }
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
     * Writes the company immediately, so a name or tax id taken by a concurrent
     * request after the checks above is still reported as HTTP 409.
     *
     * @param company company to store
     * @return the stored company
     */
    private Company saveAndFlush(Company company) {
        try {
            return companyRepository.saveAndFlush(company);
        } catch (DataIntegrityViolationException exception) {
            throw conflictOf(exception);
        }
    }

    /**
     * Translates the violation of a unique business name or tax id into
     * HTTP 409. Any other violation is not a duplicate, so it is rethrown.
     * The constraint name is read from the exception because the failed
     * transaction cannot be queried again.
     *
     * @param exception error raised by the database
     * @return the conflict to throw
     */
    static RuntimeException conflictOf(DataIntegrityViolationException exception) {
        for (Throwable cause = exception; cause != null; cause = cause.getCause()) {
            // A missing value or a broken foreign key is not a duplicate.
            if (cause instanceof ConstraintViolationException violation
                    && (violation.getKind() == ConstraintKind.UNIQUE || violation.getKind() == ConstraintKind.OTHER)) {
                // Some drivers only name the constraint inside the message, so both are read.
                String text = (violation.getConstraintName() + " " + violation.getMessage()).toLowerCase(Locale.ROOT);
                // Matches the key constraint and the index of older databases on the plain name.
                if (text.contains("uk_companies_business_name")) {
                    return new DuplicateResourceException(DUPLICATE_NAME_MESSAGE);
                }
                // Matches the key constraint and the index Hibernate generated on the plain tax id.
                if (text.contains("tax_id")) {
                    return new DuplicateResourceException(DUPLICATE_TAX_ID_MESSAGE);
                }
            }
        }
        return exception;
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
