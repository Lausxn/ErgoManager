package com.mgs.ergomanager.dto.personalizedevaluation;

/**
 * Diagnosis and recommendation of one question exposed by the API.
 *
 * @param id             identifier of the answer
 * @param questionId     identifier of the question
 * @param questionOrder  position of the question, as it was when the evaluation was written
 * @param statement      text of the question, as it was when the evaluation was written
 * @param diagnosis      findings observed by the ergonomist for the question
 * @param recommendation action proposed by the ergonomist for the question
 */
public record PersonalizedAnswerResponseDTO(
        Long id,
        Long questionId,
        Integer questionOrder,
        String statement,
        String diagnosis,
        String recommendation) {
}
