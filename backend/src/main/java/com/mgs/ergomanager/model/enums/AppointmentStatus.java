package com.mgs.ergomanager.model.enums;

import java.util.List;

/**
 * Lifecycle states of an appointment with an ergonomist.
 */
public enum AppointmentStatus {

    SCHEDULED,
    CONFIRMED,
    COMPLETED,
    CANCELLED;

    /** States of an appointment that still has to be attended. */
    public static final List<AppointmentStatus> PENDING = List.of(SCHEDULED, CONFIRMED);

    /**
     * Tells whether the appointment still has to be attended.
     *
     * @return true when scheduled or confirmed
     */
    public boolean isPending() {
        return PENDING.contains(this);
    }
}
