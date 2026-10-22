package com.mgs.ergomanager.service.impl;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.mgs.ergomanager.model.enums.RiskLevel;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

/**
 * Unit tests for the risk level of a self evaluation, which depends on the
 * average weight per question and not on the size of the form.
 */
class SelfEvaluationRiskLevelTest {

    private final SelfEvaluationServiceImpl service =
            new SelfEvaluationServiceImpl(null, null, null, null, null, null, null);

    /**
     * Verifies the three equal parts of the 1 to 3 scale with forms of
     * different sizes, including the values right next to each limit.
     *
     * @param totalScore    sum of the weights of the chosen answers
     * @param questionCount number of questions of the form
     * @param expected      expected risk level
     */
    @ParameterizedTest
    @CsvSource({
            "1, 1, LOW",
            "2, 1, MEDIUM",
            "3, 1, HIGH",
            "10, 10, LOW",
            "16, 10, LOW",
            "17, 10, MEDIUM",
            "23, 10, MEDIUM",
            "24, 10, HIGH",
            "30, 10, HIGH",
            "66, 40, LOW",
            "67, 40, MEDIUM",
            "93, 40, MEDIUM",
            "94, 40, HIGH",
            "0, 0, LOW"
    })
    void calculatesTheRiskLevelFromTheAverageWeight(int totalScore, int questionCount, RiskLevel expected) {
        assertEquals(expected, service.calculateRiskLevel(totalScore, questionCount));
    }
}
