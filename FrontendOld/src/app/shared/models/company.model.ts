/** Body sent to POST and PUT /api/companies. */
export interface CompanyRequest {
  businessName: string;
  taxId: string;
  contactEmail: string;
  phoneNumber?: string;
  address?: string;
}

/** Client company returned by /api/companies. */
export interface CompanyResponse {
  id: number;
  businessName: string;
  taxId: string;
  contactEmail: string;
  phoneNumber?: string;
  address?: string;
  active: boolean;
  createdAt: string;
}
