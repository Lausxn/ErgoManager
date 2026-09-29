package com.mgs.ergomanager.service.impl;

import com.mgs.ergomanager.model.History;
import com.mgs.ergomanager.model.PersonalizedEvaluation;
import com.mgs.ergomanager.model.SelfEvaluation;
import com.mgs.ergomanager.model.enums.HistoryType;

/**
 * Builds the history entries recorded by the services at every evaluation
 * milestone of an employee.
 */
final class HistoryEntries {

    private static final int DESCRIPTION_MAX_LENGTH = 255;

    private HistoryEntries() {
    }

    /**
     * Builds an unsaved entry linked to a self evaluation, its company and employee.
     *
     * @param type                   milestone being recorded
     * @param selfEvaluation         self evaluation the milestone belongs to
     * @param personalizedEvaluation personalized evaluation linked to the milestone, may be null
     * @param description            short text describing the milestone
     * @return unsaved history entry
     */
    static History of(HistoryType type,
                      SelfEvaluation selfEvaluation,
                      PersonalizedEvaluation personalizedEvaluation,
                      String description) {
        History history = new History();
        history.setType(type);
        history.setCompany(selfEvaluation.getCompany());
        history.setSelfEvaluation(selfEvaluation);
        history.setPersonalizedEvaluation(personalizedEvaluation);
        history.setEmployeeEmail(selfEvaluation.getEmployeeEmail());
        history.setDescription(description.length() > DESCRIPTION_MAX_LENGTH
                ? description.substring(0, DESCRIPTION_MAX_LENGTH - 1) + "…"
                : description);
        return history;
    }
}
