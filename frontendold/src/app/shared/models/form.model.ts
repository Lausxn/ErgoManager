/** Question sent as part of a form. */
export interface QuestionRequest {
  statement: string;
  questionOrder: number;
  weight: number;
}

/** Question returned as part of a form. */
export interface QuestionResponse {
  id: number;
  statement: string;
  questionOrder: number;
  weight: number;
  active: boolean;
}

/** Body sent to POST and PUT /api/forms. */
export interface FormRequest {
  title: string;
  description?: string;
  publicationYear: number;
  questionList: QuestionRequest[];
}

/** Self evaluation form returned by /api/forms. */
export interface FormResponse {
  id: number;
  title: string;
  description?: string;
  publicationYear: number;
  active: boolean;
  createdAt: string;
  questionList: QuestionResponse[];
}
