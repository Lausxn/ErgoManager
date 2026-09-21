package com.mgs.ergomanager.service;

import com.mgs.ergomanager.dto.selfevaluation.SelfEvaluationRequestDTO;
import com.mgs.ergomanager.dto.selfevaluation.SelfEvaluationResponseDTO;
import com.mgs.ergomanager.model.enums.RiskLevel;
import java.util.List;

/**
 * Self evaluations filled in by the employees of the client companies.
 */
public interface SelfEvaluationService {

    /**
     * Stores a self evaluation and calculates its risk level.
     *
     * @param request answers sent by the employee
     * @return the stored self evaluation, including its risk level
     */
    SelfEvaluationResponseDTO submit(SelfEvaluationRequestDTO request);

    /**
     * Returns a single self evaluation with its answers.
     *
     * @param id identifier of the self evaluation
     * @return the self evaluation
     */
    SelfEvaluationResponseDTO findById(Long id);

    /**
     * Returns the self evaluations submitted by the employees of a company.
     *
     * @param companyId identifier of the company
     * @return list of self evaluations
     */
    List<SelfEvaluationResponseDTO> findByCompany(Long companyId);

    /**
     * Calculates the risk level that matches a total score.
     *
     * @param totalScore sum of the weighted answer scores
     * @return risk level of the self evaluation
     */
    RiskLevel calculateRiskLevel(Integer totalScore);
}
