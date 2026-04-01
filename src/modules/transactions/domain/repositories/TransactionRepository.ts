import type {
  CreateTransactionInput,
  TransactionPage,
  StoredTransaction,
  TransactionDecision
} from "../types.js";

export interface SaveTransactionInput extends CreateTransactionInput {
  riskScore: number;
  decision: TransactionDecision;
  idempotencyHash: string;
}

export interface TransactionRepository {
  findByIdempotencyKey(idempotencyKey: string): Promise<StoredTransaction | null>;
  save(input: SaveTransactionInput): Promise<StoredTransaction>;
  findByUserCursor(userId: string, cursor: string | null, limit: number): Promise<TransactionPage>;
  updateDecisionWithVersion(
    id: string,
    expectedVersion: number,
    decision: TransactionDecision
  ): Promise<StoredTransaction | null>;
}
