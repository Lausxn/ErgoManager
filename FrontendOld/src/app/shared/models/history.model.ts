/** History entry returned by /api/histories. */
export interface HistoryResponse {
  id: number;
  companyId: number;
  selfEvaluationId?: number;
  personalizedEvaluationId?: number;
  employeeEmail: string;
  description: string;
  registeredAt: string;
}
