import { AppointmentStatus } from './appointment-status.model';

/** Body sent to POST and PUT /api/appointments/availabilities. */
export interface AvailabilityRequest {
    userId: number;
    startDateTime: string;
    endDateTime: string;
}

/** Time slot returned by /api/appointments/availabilities. */
export interface AvailabilityResponse {
    id: number;
    userId: number;
    fullName: string;
    startDateTime: string;
    endDateTime: string;
    taken: boolean;
}

/** Body sent to POST /api/appointments. */
export interface AppointmentRequest {
    selfEvaluationId: number;
    availabilityId: number;
    notes?: string;
}

/** Body sent to PATCH /api/appointments/{id}/reschedule. */
export interface AppointmentRescheduleRequest {
    availabilityId: number;
}

/** Appointment returned by /api/appointments. */
export interface AppointmentResponse {
    id: number;
    selfEvaluationId: number;
    userId: number;
    employeeName: string;
    startDateTime: string;
    endDateTime: string;
    status: AppointmentStatus;
    notes?: string;
    employeeEmail: string;
    companyId: number;
    companyName: string;
    ergonomistName: string;
    /** True once the ergonomist registered the personalized evaluation. */
    evaluated: boolean;
}
