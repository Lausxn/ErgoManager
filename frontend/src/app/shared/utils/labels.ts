import { AppointmentStatus } from '../models/appointment-status.model';
import { RiskLevel } from '../models/risk-level.model';
import { Role } from '../models/role.model';

/** Option of a select built from an enum of the backend. */
export interface EnumOption<T> {
    label: string;
    value: T;
}

export const ROLE_LABELS: Record<Role, string> = {
    ADMIN: 'Administrador',
    ERGONOMIST: 'Ergonomista'
};

export const RISK_LEVEL_LABELS: Record<RiskLevel, string> = {
    LOW: 'Bajo',
    MEDIUM: 'Medio',
    HIGH: 'Alto',
    CRITICAL: 'Crítico'
};

export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
    SCHEDULED: 'Agendada',
    CONFIRMED: 'Confirmada',
    COMPLETED: 'Completada',
    CANCELLED: 'Cancelada'
};

/**
 * Tag classes of the risk levels. They only use the brand palette: gray and
 * graphite for the low levels, wine for the ones that need attention.
 */
export const RISK_LEVEL_TAG_CLASSES: Record<RiskLevel, string> = {
    LOW: 'mgs-tag mgs-tag--neutral',
    MEDIUM: 'mgs-tag mgs-tag--strong',
    HIGH: 'mgs-tag mgs-tag--accent',
    CRITICAL: 'mgs-tag mgs-tag--critical'
};

export const APPOINTMENT_STATUS_TAG_CLASSES: Record<AppointmentStatus, string> = {
    SCHEDULED: 'mgs-tag mgs-tag--strong',
    CONFIRMED: 'mgs-tag mgs-tag--accent',
    COMPLETED: 'mgs-tag mgs-tag--neutral',
    CANCELLED: 'mgs-tag mgs-tag--muted'
};

export const ACTIVE_TAG_CLASSES = {
    active: 'mgs-tag mgs-tag--accent',
    inactive: 'mgs-tag mgs-tag--muted'
};

/**
 * Turns a label map into the options of a select.
 *
 * @param labels map from enum value to label
 * @returns list of options, in the order of the map
 */
export function toEnumOptions<T extends string>(labels: Record<T, string>): EnumOption<T>[] {
    return (Object.keys(labels) as T[]).map((value) => ({ label: labels[value], value }));
}
