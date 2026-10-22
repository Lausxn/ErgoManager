package com.mgs.ergomanager.config;

import com.mgs.ergomanager.model.Company;
import com.mgs.ergomanager.model.CompanyKeys;
import com.mgs.ergomanager.repository.CompanyRepository;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Fills the comparison keys of the companies stored before the keys existed,
 * so the unique business name and tax id rule covers them too. It only reads
 * the companies with a missing key, so after the first start it does nothing.
 *
 * <p>A key already used by another company is left empty and reported in the
 * log: that company repeats a name or tax id from before the rule, and it
 * must be renamed or corrected the next time it is edited.</p>
 */
@Component
public class CompanyKeyBackfill implements ApplicationRunner {

    private static final Logger LOGGER = LoggerFactory.getLogger(CompanyKeyBackfill.class);
    private final CompanyRepository companyRepository;

    /**
     * Builds the backfill with its repository.
     *
     * @param companyRepository repository of client companies
     */
    public CompanyKeyBackfill(CompanyRepository companyRepository) {
        this.companyRepository = companyRepository;
    }

    /**
     * Fills the missing keys.
     *
     * @param arguments application startup arguments, not used
     */
    @Override
    @Transactional
    public void run(ApplicationArguments arguments) {
        List<Company> pending = companyRepository.findByBusinessNameKeyIsNullOrTaxIdKeyIsNullOrderByIdAsc();
        if (pending.isEmpty()) {
            return;
        }
        // Oldest first: the oldest company keeps the name or tax id when two repeat it.
        Set<String> assignedNames = new HashSet<>();
        Set<String> assignedTaxIds = new HashSet<>();
        int filled = 0;
        for (Company company : pending) {
            if (company.getBusinessNameKey() == null) {
                String key = CompanyKeys.businessNameKey(company.getBusinessName());
                if (assignedNames.add(key) && !companyRepository.existsByBusinessNameKey(key)) {
                    companyRepository.setBusinessNameKey(company.getId(), key);
                    filled++;
                } else {
                    LOGGER.warn("Company {} repeats the business name \"{}\"; rename it to apply the unique rule",
                            company.getId(), company.getBusinessName());
                }
            }
            if (company.getTaxIdKey() == null) {
                String key = CompanyKeys.taxIdKey(company.getTaxId());
                if (assignedTaxIds.add(key) && !companyRepository.existsByTaxIdKey(key)) {
                    companyRepository.setTaxIdKey(company.getId(), key);
                    filled++;
                } else {
                    LOGGER.warn("Company {} repeats the tax id \"{}\"; correct it to apply the unique rule",
                            company.getId(), company.getTaxId());
                }
            }
        }
        LOGGER.info("Filled {} company comparison keys", filled);
    }
}
