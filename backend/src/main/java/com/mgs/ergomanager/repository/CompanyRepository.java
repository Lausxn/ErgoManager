package com.mgs.ergomanager.repository;

import com.mgs.ergomanager.model.Company;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

/**
 * Data access operations for the {@link Company} entity.
 */
@Repository
public interface CompanyRepository extends JpaRepository<Company, Long> {

    /**
     * Checks whether a company already uses a business name key.
     *
     * @param businessNameKey key built by {@code CompanyKeys.businessNameKey}
     * @return true when a company already uses that name
     */
    boolean existsByBusinessNameKey(String businessNameKey);

    /**
     * Checks whether a company already uses a tax id key.
     *
     * @param taxIdKey key built by {@code CompanyKeys.taxIdKey}
     * @return true when a company already uses that tax id
     */
    boolean existsByTaxIdKey(String taxIdKey);

    /**
     * Returns the companies stored before the comparison keys existed.
     *
     * @return companies with a missing key, oldest first
     */
    List<Company> findByBusinessNameKeyIsNullOrTaxIdKeyIsNullOrderByIdAsc();

    /**
     * Writes the business name key of a company without running the entity
     * callbacks, so the other key can stay empty when it is repeated.
     *
     * @param id  identifier of the company
     * @param key business name key
     */
    @Modifying
    @Query("update Company company set company.businessNameKey = :key where company.id = :id")
    void setBusinessNameKey(@Param("id") Long id, @Param("key") String key);

    /**
     * Writes the tax id key of a company without running the entity callbacks.
     *
     * @param id  identifier of the company
     * @param key tax id key
     */
    @Modifying
    @Query("update Company company set company.taxIdKey = :key where company.id = :id")
    void setTaxIdKey(@Param("id") Long id, @Param("key") String key);

    /**
     * Checks whether a company already uses a name, ignoring case. Inactive
     * companies are included, so their names remain reserved.
     *
     * @param businessName name to look for
     * @return true when a company already uses that name
     */
    boolean existsByBusinessNameIgnoreCase(String businessName);

    /**
     * Checks whether a company other than the given one uses a name, ignoring
     * case, so a company can keep its own name when it is updated.
     *
     * @param businessName name to look for
     * @param id           identifier of the company being updated
     * @return true when another company already uses that name
     */
    boolean existsByBusinessNameIgnoreCaseAndIdNot(String businessName, Long id);

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
