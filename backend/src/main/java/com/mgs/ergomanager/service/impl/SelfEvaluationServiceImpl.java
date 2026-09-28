package com.mgs.ergomanager.service.impl;

import com.mgs.ergomanager.dto.selfevaluation.SelfEvaluationRequestDTO;
import com.mgs.ergomanager.dto.selfevaluation.SelfEvaluationResponseDTO;
import com.mgs.ergomanager.model.enums.RiskLevel;
import com.mgs.ergomanager.repository.AnswerRepository;
import com.mgs.ergomanager.repository.SelfEvaluationRepository;
import com.mgs.ergomanager.service.SelfEvaluationService;
import java.util.List;
import org.springframework.stereotype.Service;

/**
 * Default implementation of {@link SelfEvaluationService}.
 */
@Service
public class SelfEvaluationServiceImpl implements SelfEvaluationService {

    private final SelfEvaluationRepository selfEvaluationRepository;

    private final AnswerRepository answerRepository;

    /**
     * Builds the service with its repositories.
     *
     * @param selfEvaluationRepository repository of self evaluations
     * @param answerRepository         repository of answers
     */
    public SelfEvaluationServiceImpl(SelfEvaluationRepository selfEvaluationRepository,
                                     AnswerRepository answerRepository) {
        this.selfEvaluationRepository = selfEvaluationRepository;
        this.answerRepository = answerRepository;
    }

    @Override
    public SelfEvaluationResponseDTO submit(SelfEvaluationRequestDTO request) {
        // TODO: store the answers, add up the weighted scores and set the risk level.
        throw new UnsupportedOperationException("SelfEvaluationService.submit is not implemented yet");
    }

    @Override
    public SelfEvaluationResponseDTO findById(Long id) {
        // TODO: read the self evaluation or raise ResourceNotFoundException.
        throw new UnsupportedOperationException("SelfEvaluationService.findById is not implemented yet");
    }

    @Override
    public List<SelfEvaluationResponseDTO> findByCompany(Long companyId) {
        // TODO: read the self evaluations of the company.
        throw new UnsupportedOperationException("SelfEvaluationService.findByCompany is not implemented yet");
    }

    @Override
    public RiskLevel calculateRiskLevel(Integer totalScore) {
        // TODO: apply the score ranges agreed with MGS.
        throw new UnsupportedOperationException("SelfEvaluationService.calculateRiskLevel is not implemented yet");
    }
}
