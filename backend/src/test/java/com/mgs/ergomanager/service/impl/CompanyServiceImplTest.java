package com.mgs.ergomanager.service.impl;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.mgs.ergomanager.dto.company.CompanyRequestDTO;
import com.mgs.ergomanager.dto.company.CompanyResponseDTO;
import com.mgs.ergomanager.exception.DuplicateResourceException;
import com.mgs.ergomanager.exception.ResourceNotFoundException;
import com.mgs.ergomanager.hu.UserStories;
import com.mgs.ergomanager.model.Company;
import com.mgs.ergomanager.model.CompanyKeys;
import com.mgs.ergomanager.repository.CompanyNameChangeRepository;
import com.mgs.ergomanager.repository.CompanyRepository;
import com.mgs.ergomanager.security.CurrentUserService;
import java.lang.reflect.Field;
import java.sql.SQLException;
import java.util.Optional;
import org.hibernate.exception.ConstraintViolationException;
import org.hibernate.exception.ConstraintViolationException.ConstraintKind;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;

/** Queries made by the company service, its translation of database conflicts and the activation of a company. */
@ExtendWith(MockitoExtension.class)
class CompanyServiceImplTest {

    @Mock
    private CompanyRepository companyRepository;

    @Mock
    private CompanyNameChangeRepository nameChangeRepository;

    @Mock
    private CurrentUserService currentUserService;

    private CompanyServiceImpl service;
    private Company stored;

    @BeforeEach
    void createService() throws ReflectiveOperationException {
        service = new CompanyServiceImpl(companyRepository, nameChangeRepository, currentUserService);
        stored = new Company();
        stored.setId(7L);
        stored.setBusinessName("Servicios del Valle");
        stored.setTaxId("3-101-500001");
        stored.setContactEmail("contacto@valle.test");
        // The keys are filled by the entity callbacks, which do not run with a mocked repository.
        setField(stored, "businessNameKey", CompanyKeys.businessNameKey("Servicios del Valle"));
        setField(stored, "taxIdKey", CompanyKeys.taxIdKey("3-101-500001"));
    }

    private static void setField(Object target, String name, Object value) throws ReflectiveOperationException {
        Field field = Company.class.getDeclaredField(name);
        field.setAccessible(true);
        field.set(target, value);
    }

    private static CompanyRequestDTO request(String name, String taxId) {
        return new CompanyRequestDTO(name, taxId, "nuevo@valle.test", "2222-3333", "Heredia");
    }

    private static DataIntegrityViolationException violation(ConstraintKind kind, String constraint) {
        ConstraintViolationException cause = new ConstraintViolationException(
                "could not execute statement", new SQLException("violation"), kind, constraint);
        return new DataIntegrityViolationException("violation", cause);
    }

    @Test
    @Tag(UserStories.HU_020)
    void anEditThatKeepsNameAndTaxIdMakesNoDuplicateQuery() {
        when(companyRepository.findByIdForUpdate(7L)).thenReturn(Optional.of(stored));
        when(companyRepository.saveAndFlush(any(Company.class))).thenAnswer(invocation -> invocation.getArgument(0));

        // Same name and tax id, written with other case, spaces and without dashes.
        service.update(7L, request("SERVICIOS   DEL VALLE", "3101500001"));

        verify(companyRepository, never()).existsByBusinessNameKey(anyString());
        verify(companyRepository, never()).existsByTaxIdKey(anyString());
    }

    @Test
    @Tag(UserStories.HU_020)
    void anEditOnlyChecksTheValueThatChanges() {
        when(companyRepository.findByIdForUpdate(7L)).thenReturn(Optional.of(stored));
        when(companyRepository.saveAndFlush(any(Company.class))).thenAnswer(invocation -> invocation.getArgument(0));

        service.update(7L, request("Valle Renovado", "3-101-500001"));

        verify(companyRepository).existsByBusinessNameKey(CompanyKeys.businessNameKey("Valle Renovado"));
        verify(companyRepository, never()).existsByTaxIdKey(anyString());
    }

    @Test
    @Tag(UserStories.HU_003)
    @Tag(UserStories.HU_020)
    void translatesTheUniqueConstraintsIntoConflictsWithTheirMessage() {
        assertThat(CompanyServiceImpl.conflictOf(violation(ConstraintKind.UNIQUE, "companies.uk_companies_business_name_key")))
                .isInstanceOf(DuplicateResourceException.class)
                .hasMessage("Ya existe una empresa con ese nombre.");
        // Index created on the plain name by older versions.
        assertThat(CompanyServiceImpl.conflictOf(violation(ConstraintKind.UNIQUE, "uk_companies_business_name")))
                .hasMessage("Ya existe una empresa con ese nombre.");
        assertThat(CompanyServiceImpl.conflictOf(violation(ConstraintKind.UNIQUE, "UK_COMPANIES_TAX_ID_KEY_INDEX_6")))
                .hasMessage("Ya existe una empresa con esa cédula jurídica.");
        assertThat(CompanyServiceImpl.conflictOf(violation(ConstraintKind.UNIQUE, "company_name_changes.uk_company_name_changes_key")))
                .hasMessageStartingWith("Ese nombre perteneció a otra empresa");
    }

    @Test
    @Tag(UserStories.HU_021)
    void deactivateMarksTheCompanyInactiveWithoutDeletingIt() {
        stored.setActive(true);
        when(companyRepository.findByIdForUpdate(7L)).thenReturn(Optional.of(stored));

        service.deactivate(7L);

        assertThat(stored.isActive()).isFalse();
        // A soft delete: the row and its data stay for the history and the reports.
        assertThat(stored.getBusinessName()).isEqualTo("Servicios del Valle");
        verify(companyRepository, never()).delete(any(Company.class));
        verify(companyRepository, never()).deleteById(any());
    }

    @Test
    @Tag(UserStories.HU_021)
    void deactivatingAnInactiveCompanyKeepsItInactive() {
        stored.setActive(false);
        when(companyRepository.findByIdForUpdate(7L)).thenReturn(Optional.of(stored));

        service.deactivate(7L);

        assertThat(stored.isActive()).isFalse();
    }

    @Test
    @Tag(UserStories.HU_021)
    void activateGivesTheCompanyBackAndAnswersTheActiveProfile() {
        stored.setActive(false);
        when(companyRepository.findByIdForUpdate(7L)).thenReturn(Optional.of(stored));

        CompanyResponseDTO response = service.activate(7L);

        assertThat(stored.isActive()).isTrue();
        assertThat(response.active()).isTrue();
        assertThat(response.businessName()).isEqualTo("Servicios del Valle");
        assertThat(response.taxId()).isEqualTo("3-101-500001");
    }

    @Test
    @Tag(UserStories.HU_021)
    void deactivatingOrActivatingAnUnknownCompanyIsNotFound() {
        when(companyRepository.findByIdForUpdate(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.deactivate(99L))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessage("No se encontró la empresa.");
        assertThatThrownBy(() -> service.activate(99L))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessage("No se encontró la empresa.");
    }

    @Test
    @Tag(UserStories.HU_020)
    @Tag(UserStories.HU_021)
    void anEditKeepsAnInactiveCompanyInactive() {
        stored.setActive(false);
        when(companyRepository.findByIdForUpdate(7L)).thenReturn(Optional.of(stored));
        when(companyRepository.saveAndFlush(any(Company.class))).thenAnswer(invocation -> invocation.getArgument(0));

        CompanyResponseDTO response = service.update(7L, request("Servicios del Valle", "3-101-500001"));

        assertThat(stored.isActive()).isFalse();
        assertThat(response.active()).isFalse();
    }

    @Test
    @Tag(UserStories.HU_003)
    @Tag(UserStories.HU_020)
    void otherViolationsAreNotReportedAsDuplicates() {
        DataIntegrityViolationException notNull = violation(ConstraintKind.NOT_NULL, "tax_id");
        assertThat(CompanyServiceImpl.conflictOf(notNull)).isSameAs(notNull);
        DataIntegrityViolationException unknown = new DataIntegrityViolationException("other");
        assertThat(CompanyServiceImpl.conflictOf(unknown)).isSameAs(unknown);
    }
}
