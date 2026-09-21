package com.mgs.ergomanager.repository;

import com.mgs.ergomanager.model.Company;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

/**
 * Data access operations for the {@link Company} entity.
 */
@Repository
public interface CompanyRepository extends JpaRepository<Company, Long> {

    /**
     * Checks whether a company is already registered with the given tax id.
     *
     * @param taxId tax id to look for
     * @return true when another company already uses that tax id
     */
    boolean existsByTaxId(String taxId);

    /**
     * Returns every company that has not been deactivated.
     *
     * @return list of active companies
     */
    List<Company> findByActiveTrue();
}
