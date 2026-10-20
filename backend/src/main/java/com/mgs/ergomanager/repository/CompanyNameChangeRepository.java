package com.mgs.ergomanager.repository;

import com.mgs.ergomanager.model.CompanyNameChange;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

/**
 * Data access operations for the {@link CompanyNameChange} entity.
 */
@Repository
public interface CompanyNameChangeRepository extends JpaRepository<CompanyNameChange, Long> {

    /**
     * Finds the company that used a business name before, if any.
     *
     * @param businessNameKey comparison key of the name
     * @return the previous name with that key
     */
    Optional<CompanyNameChange> findByBusinessNameKey(String businessNameKey);

    /**
     * Returns the previous names of a company, the most recent first.
     *
     * @param companyId identifier of the company
     * @return previous names of the company
     */
    List<CompanyNameChange> findByCompanyIdOrderByChangedAtDescIdDesc(Long companyId);

    /**
     * Returns every previous name, the most recent first, to group them by
     * company with a single query.
     *
     * @return every previous name
     */
    List<CompanyNameChange> findAllByOrderByChangedAtDescIdDesc();
}
