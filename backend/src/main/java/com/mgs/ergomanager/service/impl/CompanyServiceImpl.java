package com.mgs.ergomanager.service.impl;

import com.mgs.ergomanager.dto.company.CompanyRequestDTO;
import com.mgs.ergomanager.dto.company.CompanyResponseDTO;
import com.mgs.ergomanager.exception.DuplicateResourceException;
import com.mgs.ergomanager.exception.FieldValidationException;
import com.mgs.ergomanager.exception.ResourceNotFoundException;
import com.mgs.ergomanager.model.Company;
import com.mgs.ergomanager.model.CompanyKeys;
import com.mgs.ergomanager.model.CompanyNameChange;
import com.mgs.ergomanager.repository.CompanyNameChangeRepository;
import com.mgs.ergomanager.repository.CompanyRepository;
import com.mgs.ergomanager.security.CurrentUserService;
import com.mgs.ergomanager.service.CompanyService;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
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
    private static final String RESERVED_NAME_MESSAGE = "Ese nombre perteneció a otra empresa y queda reservado para ella. "
            + "Agregue un distintivo, por ejemplo un número o la sede.";
    private static final Pattern BUSINESS_NAME_FORMAT = Pattern.compile("[\\p{L}\\p{N}]");
    private static final Pattern TAX_ID_FORMAT = Pattern.compile("\\d-\\d{3}-\\d{6}");
    private static final Pattern PHONE_NUMBER_FORMAT = Pattern.compile("\\+?(?:[ ()-]*\\d){8,15}[ ()-]*");
    private static final String BUSINESS_NAME_FORMAT_MESSAGE = "La razón social debe incluir letras o números.";
    private static final String TAX_ID_FORMAT_MESSAGE = "Escriba la cédula jurídica con el formato 3-101-123456.";
    private static final String PHONE_NUMBER_FORMAT_MESSAGE =
            "Escriba un teléfono válido de 8 a 15 dígitos, por ejemplo 2222-3333.";
    private final CompanyRepository companyRepository;
    private final CompanyNameChangeRepository nameChangeRepository;
    private final CurrentUserService currentUserService;

    /**
     * Builds the service with its collaborators.
     *
     * @param companyRepository    repository of client companies
     * @param nameChangeRepository repository of the names the companies used before
     * @param currentUserService   access to the signed in user, who renames a company
     */
    public CompanyServiceImpl(CompanyRepository companyRepository, CompanyNameChangeRepository nameChangeRepository,
                              CurrentUserService currentUserService) {
        this.companyRepository = companyRepository;
        this.nameChangeRepository = nameChangeRepository;
        this.currentUserService = currentUserService;
    }

    @Override
    @Transactional(readOnly = true)
    public List<CompanyResponseDTO> findAll() {
        // One query for every previous name instead of one per company.
        Map<Long, List<String>> previousNames = nameChangeRepository.findAllByOrderByChangedAtDescIdDesc().stream()
                .collect(Collectors.groupingBy(change -> change.getCompany().getId(),
                        Collectors.mapping(CompanyNameChange::getBusinessName, Collectors.toList())));
        return companyRepository.findAllByOrderByBusinessNameAsc().stream()
                .map(company -> toResponse(company, previousNames.getOrDefault(company.getId(), List.of())))
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
        checkBusinessNameIsFree(CompanyKeys.businessNameKey(request.businessName()), null);
        checkTaxIdIsFree(CompanyKeys.taxIdKey(request.taxId()));
        Company company = new Company();
        copy(request, company);
        company.setActive(true);
        return toResponse(saveAndFlush(company), List.of());
    }

    @Override
    @Transactional
    public CompanyResponseDTO update(Long id, CompanyRequestDTO request) {
        Company company = getCompany(id);
        checkFormats(request, company);
        // Only a value that changes can collide with another company, so an
        // edit that keeps the name and the tax id needs no extra query.
        String businessNameKey = CompanyKeys.businessNameKey(request.businessName());
        // A change of case or spaces only is not a rename: the key stays the same.
        boolean renamed = !businessNameKey.equals(company.getBusinessNameKey());
        if (renamed) {
            checkBusinessNameIsFree(businessNameKey, company);
        }
        String taxIdKey = CompanyKeys.taxIdKey(request.taxId());
        if (!taxIdKey.equals(company.getTaxIdKey())) {
            checkTaxIdIsFree(taxIdKey);
        }
        String previousName = company.getBusinessName();
        // A company that repeated an older name never owned it, so it does not reserve it.
        boolean ownedPreviousName = company.getBusinessNameKey() != null;
        copy(request, company);
        saveAndFlush(company);
        if (renamed) {
            rememberPreviousName(company, previousName, ownedPreviousName, businessNameKey);
        }
        return toResponse(company);
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
     * Keeps the name a company stopped using, so its reports can still be
     * found by it and no other company can take it. Coming back to a former
     * name turns it into the current name again.
     *
     * @param company           company that was renamed
     * @param previousName      name it used until now
     * @param ownedPreviousName false when the previous name repeated another company
     * @param currentNameKey    comparison key of the new name
     */
    private void rememberPreviousName(Company company, String previousName, boolean ownedPreviousName,
                                      String currentNameKey) {
        // The checks above guarantee that a former name with this key belongs to this company.
        nameChangeRepository.findByBusinessNameKey(currentNameKey).ifPresent(nameChangeRepository::delete);
        if (!ownedPreviousName) {
            return;
        }
        CompanyNameChange change = nameChangeRepository.findByBusinessNameKey(CompanyKeys.businessNameKey(previousName))
                .orElseGet(CompanyNameChange::new);
        change.setCompany(company);
        change.setBusinessName(previousName);
        change.setChangedAt(LocalDateTime.now());
        change.setChangedBy(currentUserService.getCurrentUser());
        try {
            nameChangeRepository.saveAndFlush(change);
        } catch (DataIntegrityViolationException exception) {
            throw conflictOf(exception);
        }
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
     * Fails with HTTP 409 when another company uses the business name now or
     * used it before. A company may take back one of its own former names.
     *
     * @param businessNameKey comparison key of the name
     * @param company         company being renamed, or null when creating one
     */
    private void checkBusinessNameIsFree(String businessNameKey, Company company) {
        if (companyRepository.existsByBusinessNameKey(businessNameKey)) {
            throw new DuplicateResourceException(DUPLICATE_NAME_MESSAGE);
        }
        boolean reservedByAnother = nameChangeRepository.findByBusinessNameKey(businessNameKey)
                .filter(change -> company == null || !change.getCompany().getId().equals(company.getId()))
                .isPresent();
        if (reservedByAnother) {
            throw new DuplicateResourceException(RESERVED_NAME_MESSAGE);
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
                if (text.contains(CompanyNameChange.KEY_CONSTRAINT)) {
                    return new DuplicateResourceException(RESERVED_NAME_MESSAGE);
                }
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
     * Maps a company to the representation exposed by the API, reading its
     * previous names.
     *
     * @param company stored company
     * @return company response
     */
    private CompanyResponseDTO toResponse(Company company) {
        List<String> previousNames = nameChangeRepository.findByCompanyIdOrderByChangedAtDescIdDesc(company.getId())
                .stream()
                .map(CompanyNameChange::getBusinessName)
                .toList();
        return toResponse(company, previousNames);
    }

    /**
     * Maps a company to the representation exposed by the API.
     *
     * @param company       stored company
     * @param previousNames names the company used before, the most recent first
     * @return company response
     */
    private static CompanyResponseDTO toResponse(Company company, List<String> previousNames) {
        return new CompanyResponseDTO(
                company.getId(),
                company.getBusinessName(),
                company.getTaxId(),
                company.getContactEmail(),
                company.getPhoneNumber(),
                company.getAddress(),
                company.isActive(),
                company.getCreatedAt(),
                previousNames);
    }
}
