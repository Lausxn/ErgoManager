/** Milestone recorded by a history entry. */
export type HistoryType = 'SELF_EVALUATION' | 'APPOINTMENT_BOOKED' | 'APPOINTMENT_CANCELLED' | 'PERSONALIZED_EVALUATION';

/** History entry returned by /api/histories. */
export interface HistoryResponse {
    id: number;
    companyId: number;
    selfEvaluationId?: number;
    personalizedEvaluationId?: number;
    employeeEmail: string;
    description: string;
    registeredAt: string;
    companyName: string;
    /** Absent only on entries recorded before the field existed. */
    type?: HistoryType;
}
