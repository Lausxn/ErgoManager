package com.mgs.ergomanager.service.impl;

import com.mgs.ergomanager.model.enums.RiskLevel;

/**
 * Ergonomic risk of a self evaluation on the 1 to 3 scale of the answer
 * weights, whatever the number of questions of the form.
 */
final class RiskScale {

    /** Lowest and highest weight of a predefined answer. */
    private static final int MIN_WEIGHT = 1;
    private static final int MAX_WEIGHT = 3;

    private RiskScale() {
    }

    /**
     * Risk level from the average weight per question. The scale is split in
     * three equal parts: an average below 5/3 (under 33.33 %) is low, below 7/3
     * (under 66.67 %) is medium and from 7/3 on is high. It compares in whole
     * numbers (average &lt; 5/3 is 3 * total &lt; 5 * questions), so a result
     * right on a limit is never misread because of decimals.
     *
     * @param totalScore    sum of the weights of the chosen answers
     * @param questionCount number of questions of the form
     * @return LOW, MEDIUM or HIGH
     */
    static RiskLevel levelOf(int totalScore, int questionCount) {
        if (questionCount <= 0 || 3L * totalScore < 5L * questionCount) {
            return RiskLevel.LOW;
        }
        if (3L * totalScore < 7L * questionCount) {
            return RiskLevel.MEDIUM;
        }
        return RiskLevel.HIGH;
    }

    /**
     * Average weight per question, from 1 to 3.
     *
     * @param totalScore    sum of the weights of the chosen answers
     * @param questionCount number of questions of the form
     * @return average weight
     */
    static double averageOf(int totalScore, int questionCount) {
        return questionCount <= 0 ? MIN_WEIGHT : (double) totalScore / questionCount;
    }

    /**
     * Position of the average in the 1 to 3 scale: 1 is 0 %, 2 is 50 % and 3 is
     * 100 %.
     *
     * @param totalScore    sum of the weights of the chosen answers
     * @param questionCount number of questions of the form
     * @return risk percentage, from 0 to 100
     */
    static double percentageOf(int totalScore, int questionCount) {
        return (averageOf(totalScore, questionCount) - MIN_WEIGHT) * 100.0 / (MAX_WEIGHT - MIN_WEIGHT);
    }
}
