/** Answer sent as part of a personalized evaluation. */
export interface PersonalizedAnswerRequest {
    questionId: number;
    diagnosis: string;
    recommendation: string;
}

/** Answer returned as part of a personalized evaluation. */
export interface PersonalizedAnswerResponse {
    id: number;
    questionId: number;
    questionOrder: number;
    statement: string;
    diagnosis: string;
    recommendation: string;
}

/** Body sent to POST /api/personalized-evaluations. */
export interface PersonalizedEvaluationRequest {
    appointmentId: number;
    formId: number;
    answerList: PersonalizedAnswerRequest[];
}

/** Personalized evaluation returned by /api/personalized-evaluations. */
export interface PersonalizedEvaluationResponse {
    id: number;
    appointmentId: number;
    userId: number;
    employeeName: string;
    formId?: number;
    formTitle?: string;
    reportPath?: string;
    evaluatedAt: string;
    employeeEmail: string;
    companyName: string;
    answerList: PersonalizedAnswerResponse[];
}
