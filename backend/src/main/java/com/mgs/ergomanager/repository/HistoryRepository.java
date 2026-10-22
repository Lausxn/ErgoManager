package com.mgs.ergomanager.repository;

import com.mgs.ergomanager.model.History;
import java.util.List;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

/**
 * Data access operations for the {@link History} entity.
 */
@Repository
public interface HistoryRepository extends JpaRepository<History, Long> {

    /**
     * Returns the history entries of a company, newest first, with the company
     * already loaded.
     *
     * @param companyId identifier of the company
     * @return list of history entries
     */
    @EntityGraph(attributePaths = "company")
    List<History> findByCompanyIdOrderByRegisteredAtDescIdDesc(Long companyId);

    /**
     * Returns the history entries of an employee, newest first, with the
     * company already loaded.
     *
     * @param employeeEmail email of the employee
     * @return list of history entries
     */
    @EntityGraph(attributePaths = "company")
    List<History> findByEmployeeEmailOrderByRegisteredAtDescIdDesc(String employeeEmail);
}
