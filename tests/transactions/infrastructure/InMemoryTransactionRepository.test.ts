import { InMemoryTransactionRepository } from "../../../src/modules/transactions/infrastructure/repositories/InMemoryTransactionRepository.js";

describe("InMemoryTransactionRepository", () => {
  it("should increment version when optimistic lock matches", async () => {
    // Arrange
    const repository = new InMemoryTransactionRepository();
    const saved = await repository.save({
      idempotencyKey: "optimistic-key-0001",
      idempotencyHash: "hash-1",
      userId: "user-opt",
      amount: 42,
      currency: "USD",
      occurredAt: new Date(),
      riskScore: 10,
      decision: "APPROVED"
    });

    // Act
    const updated = await repository.updateDecisionWithVersion(
      saved.id,
      saved.version,
      "REVIEW"
    );

    // Assert
    expect(updated).not.toBeNull();
    expect(updated?.decision).toBe("REVIEW");
    expect(updated?.version).toBe(2);
  });

  it("should return null when optimistic lock version mismatches", async () => {
    // Arrange
    const repository = new InMemoryTransactionRepository();
    const saved = await repository.save({
      idempotencyKey: "optimistic-key-0002",
      idempotencyHash: "hash-2",
      userId: "user-opt",
      amount: 45,
      currency: "USD",
      occurredAt: new Date(),
      riskScore: 10,
      decision: "APPROVED"
    });

    // Act
    const updated = await repository.updateDecisionWithVersion(
      saved.id,
      saved.version + 1,
      "BLOCKED"
    );

    // Assert
    expect(updated).toBeNull();
  });
});
