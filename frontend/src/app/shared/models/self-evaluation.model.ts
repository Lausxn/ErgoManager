import { RiskLevel } from './risk-level.model';

/** Answer sent as part of a self evaluation. */
export interface AnswerRequest {
  questionId: number;
  selectedOption: string;
  score: number;
}

/** Answer returned as part of a self evaluation. */
export interface AnswerResponse {
  id: number;
  questionId: number;
  statement: string;
  selectedOption: string;
  score: number;
}

/** Body sent to POST /api/self-evaluations. */
export interface SelfEvaluationRequest {
  formId: number;
  companyId: number;
  employeeName: string;
  employeeEmail: string;
  employeePosition?: string;
  answerList: AnswerRequest[];
}

/** Self evaluation returned by /api/self-evaluations. */
export interface SelfEvaluationResponse {
  id: number;
  formId: number;
  companyId: number;
  employeeName: string;
  employeeEmail: string;
  employeePosition?: string;
  totalScore: number;
  riskLevel: RiskLevel;
  submittedAt: string;
  answerList: AnswerResponse[];
}
