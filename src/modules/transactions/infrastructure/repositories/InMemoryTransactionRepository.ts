import { randomUUID } from "node:crypto";
import type {
  SaveTransactionInput,
  TransactionRepository
} from "../../domain/repositories/TransactionRepository.js";
import type { StoredTransaction, TransactionDecision, TransactionPage } from "../../domain/types.js";

export class InMemoryTransactionRepository implements TransactionRepository {
  private readonly storage = new Map<string, StoredTransaction>();

  public async findByIdempotencyKey(
    idempotencyKey: string
  ): Promise<StoredTransaction | null> {
    return this.storage.get(idempotencyKey) ?? null;
  }

  public async save(input: SaveTransactionInput): Promise<StoredTransaction> {
    const entity: StoredTransaction = {
      id: randomUUID(),
      userId: input.userId,
      amount: input.amount,
      currency: input.currency,
      riskScore: input.riskScore,
      decision: input.decision,
      idempotencyKey: input.idempotencyKey,
      idempotencyHash: input.idempotencyHash,
      createdAt: new Date(),
      version: 1
    };

    this.storage.set(input.idempotencyKey, entity);
    return entity;
  }

  public async findByUserCursor(
    userId: string,
    cursor: string | null,
    limit: number
  ): Promise<TransactionPage> {
    const sorted = [...this.storage.values()]
      .filter((item) => item.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const startIndex =
      cursor === null ? 0 : Math.max(0, sorted.findIndex((item) => item.id === cursor) + 1);

    const pageItems = sorted.slice(startIndex, startIndex + limit);
    const lastItem = pageItems.length > 0 ? pageItems[pageItems.length - 1] : null;
    const hasMore = startIndex + limit < sorted.length;

    return {
      items: pageItems,
      nextCursor: hasMore && lastItem ? lastItem.id : null
    };
  }

  public async updateDecisionWithVersion(
    id: string,
    expectedVersion: number,
    decision: TransactionDecision
  ): Promise<StoredTransaction | null> {
    const entry = [...this.storage.entries()].find(([, transaction]) => transaction.id === id);
    if (!entry) {
      return null;
    }

    const [idempotencyKey, transaction] = entry;
    if (transaction.version !== expectedVersion) {
      return null;
    }

    const updated: StoredTransaction = {
      ...transaction,
      decision,
      version: transaction.version + 1
    };

    this.storage.set(idempotencyKey, updated);
    return updated;
  }
}
