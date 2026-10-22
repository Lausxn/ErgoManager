/** Form categories supported by HU-009. */
export type FormType = 'SELF_EVALUATION' | 'PERSONALIZED_EVALUATION';
export interface AnswerOptionRequest {
    id?: number;
    label: string;
    weight: number;
    optionOrder: number;
}
export interface AnswerOptionResponse {
    id: number;
    label: string;
    weight?: number;
    optionOrder: number;
}
export interface QuestionRequest {
    id?: number;
    statement: string;
    questionOrder: number;
    optionList?: AnswerOptionRequest[];
}
export interface QuestionResponse {
    id: number;
    statement: string;
    questionOrder: number;
    active: boolean;
    optionList?: AnswerOptionResponse[];
}
export interface FormRequest {
    title: string;
    description?: string;
    publicationYear: number;
    type: FormType;
    questionList: QuestionRequest[];
}
export interface FormResponse {
    id: number;
    title: string;
    description?: string;
    publicationYear: number;
    type: FormType;
    active: boolean;
    createdAt: string;
    questionList: QuestionResponse[];
}
export interface FormResendResponse {
    recipientCount: number;
}
