package com.mgs.ergomanager.dto.form;

/**
 * Predefined answer of a self evaluation question exposed by the API.
 *
 * @param id          identifier of the option
 * @param label       text of the answer shown to the employee
 * @param weight      risk weight: 1 low or no risk, 2 moderate risk, 3 high risk; null, and so
 *                    left out of the JSON, in the public form answered by the employees
 * @param optionOrder position of the answer inside the question
 */
public record AnswerOptionResponseDTO(
        Long id,
        String label,
        Integer weight,
        Integer optionOrder) {
}
