export interface ApprovalDelegationResponse {
  id: string;
  delegatingManager: {
    id: string;
    name: string;
    email: string;
  };
  delegatedManager: {
    id: string;
    name: string;
    email: string;
  };
  effectiveFrom: string;
  effectiveUntil: string;
  createdAt: string;
}

export interface CreateApprovalDelegationInput {
  delegatedManagerId: string;
  effectiveFrom: Date;
  effectiveUntil: Date;
}
