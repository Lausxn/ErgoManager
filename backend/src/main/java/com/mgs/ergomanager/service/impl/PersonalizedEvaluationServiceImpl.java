package com.mgs.ergomanager.service.impl;

import com.mgs.ergomanager.dto.personalizedevaluation.PersonalizedEvaluationRequestDTO;
import com.mgs.ergomanager.dto.personalizedevaluation.PersonalizedEvaluationResponseDTO;
import com.mgs.ergomanager.repository.PersonalizedEvaluationRepository;
import com.mgs.ergomanager.service.PersonalizedEvaluationService;
import java.util.List;
import org.springframework.stereotype.Service;

/**
 * Default implementation of {@link PersonalizedEvaluationService}.
 */
@Service
public class PersonalizedEvaluationServiceImpl implements PersonalizedEvaluationService {

    private final PersonalizedEvaluationRepository personalizedEvaluationRepository;

    /**
     * Builds the service with its repository.
     *
     * @param personalizedEvaluationRepository repository of personalized evaluations
     */
    public PersonalizedEvaluationServiceImpl(PersonalizedEvaluationRepository personalizedEvaluationRepository) {
        this.personalizedEvaluationRepository = personalizedEvaluationRepository;
    }

    @Override
    public PersonalizedEvaluationResponseDTO create(PersonalizedEvaluationRequestDTO request) {
        // TODO: store the evaluation and close the related appointment.
        throw new UnsupportedOperationException("PersonalizedEvaluationService.create is not implemented yet");
    }

    @Override
    public PersonalizedEvaluationResponseDTO findById(Long id) {
        // TODO: read the evaluation or raise ResourceNotFoundException.
        throw new UnsupportedOperationException("PersonalizedEvaluationService.findById is not implemented yet");
    }

    @Override
    public List<PersonalizedEvaluationResponseDTO> findByErgonomist(Long userId) {
        // TODO: read the evaluations written by the ergonomist.
        throw new UnsupportedOperationException(
                "PersonalizedEvaluationService.findByErgonomist is not implemented yet");
    }

    @Override
    public byte[] generateReport(Long id) {
        // TODO: render the evaluation as a PDF report and store its path.
        throw new UnsupportedOperationException("PersonalizedEvaluationService.generateReport is not implemented yet");
    }
}
