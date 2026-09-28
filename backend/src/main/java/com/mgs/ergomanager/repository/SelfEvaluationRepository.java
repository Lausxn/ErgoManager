package com.mgs.ergomanager.repository;

import com.mgs.ergomanager.model.SelfEvaluation;
import com.mgs.ergomanager.model.enums.RiskLevel;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

/**
 * Data access operations for the {@link SelfEvaluation} entity.
 */
@Repository
public interface SelfEvaluationRepository extends JpaRepository<SelfEvaluation, Long> {

    /**
     * Returns the self evaluations submitted by the employees of a company.
     *
     * @param companyId identifier of the company
     * @return list of self evaluations
     */
    List<SelfEvaluation> findByCompanyId(Long companyId);

    /**
     * Returns the self evaluations that reached a given risk level.
     *
     * @param riskLevel risk level to filter by
     * @return list of self evaluations
     */
    List<SelfEvaluation> findByRiskLevel(RiskLevel riskLevel);

    /**
     * Returns the self evaluations of an employee, newest first.
     *
     * @param employeeEmail email of the employee
     * @return list of self evaluations
     */
    List<SelfEvaluation> findByEmployeeEmailOrderBySubmittedAtDesc(String employeeEmail);
}
