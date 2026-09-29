package com.mgs.ergomanager.model.enums;

/**
 * Milestone recorded by a history entry, so clients do not have to guess it
 * from the linked evaluations.
 */
public enum HistoryType {
    SELF_EVALUATION,
    APPOINTMENT_BOOKED,
    APPOINTMENT_CANCELLED,
    PERSONALIZED_EVALUATION
}
