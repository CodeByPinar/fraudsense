export type TransactionDecision = "APPROVED" | "BLOCKED" | "REVIEW";

export interface CreateTransactionInput {
  idempotencyKey: string;
  userId: string;
  amount: number;
  currency: string;
  deviceFingerprint?: string;
  latitude?: number;
  longitude?: number;
  occurredAt: Date;
}

export interface StoredTransaction {
  id: string;
  userId: string;
  amount: number;
  currency: string;
  riskScore: number;
  decision: TransactionDecision;
  idempotencyKey: string;
  idempotencyHash: string;
  createdAt: Date;
  version: number;
}

export interface TransactionPage {
  items: StoredTransaction[];
  nextCursor: string | null;
}
