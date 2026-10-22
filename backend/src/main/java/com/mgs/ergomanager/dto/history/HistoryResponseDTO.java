package com.mgs.ergomanager.dto.history;

import com.mgs.ergomanager.model.enums.HistoryType;
import java.time.LocalDateTime;

/**
 * History entry exposed by the API.
 *
 * @param id                       identifier of the entry
 * @param companyId                identifier of the client company
 * @param selfEvaluationId         self evaluation linked to the entry
 * @param personalizedEvaluationId personalized evaluation linked to the entry
 * @param employeeEmail            email of the employee the entry belongs to
 * @param description              short text describing the milestone
 * @param registeredAt             moment the entry was recorded
 * @param companyName              business name of the client company
 * @param type                     milestone recorded, null for entries older than this field
 */
public record HistoryResponseDTO(
        Long id,
        Long companyId,
        Long selfEvaluationId,
        Long personalizedEvaluationId,
        String employeeEmail,
        String description,
        LocalDateTime registeredAt,
        String companyName,
        HistoryType type) {
}
