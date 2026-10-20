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
     * Calculates the risk level of a self evaluation from the average weight of
     * its answers (sum of the weights divided by the number of questions), so
     * forms with a different number of questions are compared on the same 1 to
     * 3 scale. The scale is split in three equal parts: an average below 5/3
     * (under 33.33 %) is low, below 7/3 (under 66.67 %) is medium and from 7/3
     * on is high.
     *
     * @param totalScore    sum of the weights of the chosen answers
     * @param questionCount number of questions of the form
     * @return risk level of the self evaluation: LOW, MEDIUM or HIGH
     */
    RiskLevel calculateRiskLevel(int totalScore, int questionCount);
}
