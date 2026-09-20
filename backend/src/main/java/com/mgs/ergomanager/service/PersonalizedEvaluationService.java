package com.mgs.ergomanager.service;

import com.mgs.ergomanager.dto.personalizedevaluation.PersonalizedEvaluationRequest;
import com.mgs.ergomanager.dto.personalizedevaluation.PersonalizedEvaluationResponse;
import java.util.List;

/**
 * Evaluations written by the ergonomists and the PDF reports derived from them.
 */
public interface PersonalizedEvaluationService {

    /**
     * Stores the evaluation written after an appointment.
     *
     * @param request data written by the ergonomist
     * @return the stored evaluation
     */
    PersonalizedEvaluationResponse create(PersonalizedEvaluationRequest request);

    /**
     * Returns a single evaluation.
     *
     * @param id identifier of the evaluation
     * @return the evaluation
     */
    PersonalizedEvaluationResponse findById(Long id);

    /**
     * Returns the evaluations written by an ergonomist.
     *
     * @param userId identifier of the ergonomist
     * @return list of evaluations
     */
    List<PersonalizedEvaluationResponse> findByErgonomist(Long userId);

    /**
     * Generates the PDF report of an evaluation.
     *
     * @param id identifier of the evaluation
     * @return content of the generated PDF file
     */
    byte[] generateReport(Long id);
}
