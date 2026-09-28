package com.mgs.ergomanager.repository;

import com.mgs.ergomanager.model.History;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

/**
 * Data access operations for the {@link History} entity.
 */
@Repository
public interface HistoryRepository extends JpaRepository<History, Long> {

    /**
     * Returns the history entries of a company, newest first.
     *
     * @param companyId identifier of the company
     * @return list of history entries
     */
    List<History> findByCompanyIdOrderByRegisteredAtDesc(Long companyId);

    /**
     * Returns the history entries of an employee, newest first.
     *
     * @param employeeEmail email of the employee
     * @return list of history entries
     */
    List<History> findByEmployeeEmailOrderByRegisteredAtDesc(String employeeEmail);
}
