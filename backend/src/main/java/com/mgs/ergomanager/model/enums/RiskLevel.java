package com.mgs.ergomanager.model.enums;

/**
 * Ergonomic risk level calculated from a self evaluation score.
 */
public enum RiskLevel {

    LOW("Bajo"),
    MEDIUM("Medio"),
    HIGH("Alto"),
    CRITICAL("Crítico");

    private final String label;

    RiskLevel(String label) {
        this.label = label;
    }

    /**
     * Returns the Spanish name shown to the users, in history entries and reports.
     *
     * @return label of the risk level
     */
    public String getLabel() {
        return label;
    }
}
