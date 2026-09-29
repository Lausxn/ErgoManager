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
     * Checks whether a company other than the given one uses a tax id.
     *
     * @param taxId tax id to look for
     * @param id    identifier of the company being updated
     * @return true when another company already uses that tax id
     */
    boolean existsByTaxIdAndIdNot(String taxId, Long id);

    /**
     * Returns every company that has not been deactivated.
     *
     * @return list of active companies
     */
    List<Company> findByActiveTrue();

    /**
     * Returns every company ordered by business name.
     *
     * @return ordered list of companies
     */
    List<Company> findAllByOrderByBusinessNameAsc();

    /**
     * Counts the companies that have not been deactivated.
     *
     * @return number of active companies
     */
    long countByActiveTrue();
}
