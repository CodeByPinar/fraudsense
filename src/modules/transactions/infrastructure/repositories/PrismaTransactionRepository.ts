import type { PrismaClient } from "@prisma/client";
import type {
  SaveTransactionInput,
  TransactionRepository
} from "../../domain/repositories/TransactionRepository.js";
import type {
  StoredTransaction,
  TransactionDecision,
  TransactionPage
} from "../../domain/types.js";

export class PrismaTransactionRepository implements TransactionRepository {
  public constructor(private readonly prisma: PrismaClient) {}

  public async findByIdempotencyKey(
    idempotencyKey: string
  ): Promise<StoredTransaction | null> {
    const row = await this.prisma.transaction.findUnique({
      where: { idempotencyKey }
    });

    if (!row) {
      return null;
    }

    return {
      id: row.id,
      userId: row.userId,
      amount: Number(row.amount),
      currency: row.currency,
      riskScore: row.riskScore,
      decision: row.decision as TransactionDecision,
      idempotencyKey: row.idempotencyKey,
      idempotencyHash: row.idempotencyHash,
      createdAt: row.createdAt,
      version: row.version
    };
  }

  public async save(input: SaveTransactionInput): Promise<StoredTransaction> {
    const row = await this.prisma.transaction.create({
      data: {
        userId: input.userId,
        amount: input.amount,
        currency: input.currency,
        riskScore: input.riskScore,
        decision: input.decision,
        idempotencyKey: input.idempotencyKey,
        idempotencyHash: input.idempotencyHash,
        deviceFingerprint: input.deviceFingerprint
      }
    });

    return {
      id: row.id,
      userId: row.userId,
      amount: Number(row.amount),
      currency: row.currency,
      riskScore: row.riskScore,
      decision: row.decision as TransactionDecision,
      idempotencyKey: row.idempotencyKey,
      idempotencyHash: row.idempotencyHash,
      createdAt: row.createdAt,
      version: row.version
    };
  }

  public async findByUserCursor(
    userId: string,
    cursor: string | null,
    limit: number
  ): Promise<TransactionPage> {
    const rows = await this.prisma.transaction.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(cursor
        ? {
            cursor: { id: cursor },
            skip: 1
          }
        : {})
    });

    const sliced = rows.slice(0, limit);
    const mapped = sliced.map((row: {
      id: string;
      userId: string;
      amount: number | { toString(): string };
      currency: string;
      riskScore: number;
      decision: string;
      idempotencyKey: string;
      idempotencyHash: string;
      createdAt: Date;
      version: number;
    }) => ({
      id: row.id,
      userId: row.userId,
      amount: Number(row.amount),
      currency: row.currency,
      riskScore: row.riskScore,
      decision: row.decision as TransactionDecision,
      idempotencyKey: row.idempotencyKey,
      idempotencyHash: row.idempotencyHash,
      createdAt: row.createdAt,
      version: row.version
    }));

    return {
      items: mapped,
      nextCursor: rows.length > limit ? mapped[mapped.length - 1]?.id ?? null : null
    };
  }

  public async updateDecisionWithVersion(
    id: string,
    expectedVersion: number,
    decision: TransactionDecision
  ): Promise<StoredTransaction | null> {
    const result = await this.prisma.transaction.updateMany({
      where: {
        id,
        version: expectedVersion
      },
      data: {
        decision,
        version: {
          increment: 1
        }
      }
    });

    if (result.count === 0) {
      return null;
    }

    const refreshed = await this.prisma.transaction.findUnique({ where: { id } });
    if (!refreshed) {
      return null;
    }

    return {
      id: refreshed.id,
      userId: refreshed.userId,
      amount: Number(refreshed.amount),
      currency: refreshed.currency,
      riskScore: refreshed.riskScore,
      decision: refreshed.decision as TransactionDecision,
      idempotencyKey: refreshed.idempotencyKey,
      idempotencyHash: refreshed.idempotencyHash,
      createdAt: refreshed.createdAt,
      version: refreshed.version
    };
  }
}
