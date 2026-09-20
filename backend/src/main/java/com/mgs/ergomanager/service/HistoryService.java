package com.mgs.ergomanager.service;

import com.mgs.ergomanager.dto.history.HistoryResponse;
import java.util.List;

/**
 * Read only access to the evaluation history.
 */
public interface HistoryService {

    /**
     * Returns the history entries of a client company, newest first.
     *
     * @param companyId identifier of the company
     * @return list of history entries
     */
    List<HistoryResponse> findByCompany(Long companyId);

    /**
     * Returns the history entries of an employee, newest first.
     *
     * @param employeeEmail email of the employee
     * @return list of history entries
     */
    List<HistoryResponse> findByEmployee(String employeeEmail);
}
