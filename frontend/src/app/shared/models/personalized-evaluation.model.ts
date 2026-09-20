import { RiskLevel } from './risk-level.model';

/** Body sent to POST /api/personalized-evaluations. */
export interface PersonalizedEvaluationRequest {
  appointmentId: number;
  diagnosis: string;
  recommendations: string;
  riskLevel: RiskLevel;
}

/** Personalized evaluation returned by /api/personalized-evaluations. */
export interface PersonalizedEvaluationResponse {
  id: number;
  appointmentId: number;
  userId: number;
  employeeName: string;
  diagnosis: string;
  recommendations: string;
  riskLevel: RiskLevel;
  reportPath?: string;
  evaluatedAt: string;
}
