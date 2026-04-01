import { createHash } from "node:crypto";
import type { FraudDecisionService } from "../../fraud/application/FraudDecisionService.js";
import { RuleChain } from "../../fraud/application/rule-engine/RuleChain.js";
import { RuleLoader } from "../../fraud/application/rule-engine/RuleLoader.js";
import type { FraudRuleRepository } from "../../fraud/domain/repositories/FraudRuleRepository.js";
import type { UserRiskProfile } from "../../fraud/domain/types.js";
import { ConflictError, ValidationError } from "../../../shared/errors/AppError.js";
import type { TransactionRepository } from "../domain/repositories/TransactionRepository.js";
import type { CreateTransactionInput, StoredTransaction } from "../domain/types.js";

export interface CreateTransactionResult {
  transaction: StoredTransaction;
  wasCreated: boolean;
}

export class CreateTransactionUseCase {
  public constructor(
    private readonly transactionRepository: TransactionRepository,
    private readonly fraudRuleRepository: FraudRuleRepository,
    private readonly fraudDecisionService: FraudDecisionService
  ) {}

  /**
   * Creates transaction in idempotent manner and computes fraud decision.
   */
  public async execute(input: CreateTransactionInput): Promise<CreateTransactionResult> {
    if (!input.idempotencyKey) {
      throw new ValidationError("Idempotency key is required");
    }

    const idempotencyHash = createHash("sha256")
      .update(
        JSON.stringify({
          userId: input.userId,
          amount: input.amount,
          currency: input.currency,
          deviceFingerprint: input.deviceFingerprint ?? null,
          latitude: input.latitude ?? null,
          longitude: input.longitude ?? null,
          occurredAt: input.occurredAt.toISOString()
        })
      )
      .digest("hex");

    const existing = await this.transactionRepository.findByIdempotencyKey(
      input.idempotencyKey
    );
    if (existing) {
      if (existing.idempotencyHash !== idempotencyHash) {
        throw new ConflictError(
          "Idempotency key was already used with different payload",
          {
            idempotencyKey: input.idempotencyKey
          }
        );
      }

      return {
        transaction: existing,
        wasCreated: false
      };
    }

    const profile: UserRiskProfile = {
      meanAmount: 100,
      stdDeviationAmount: 20,
      usualHourMean: 12,
      usualHourStdDeviation: 2
    };

    const rules = await this.fraudRuleRepository.getEnabledRules();
    const thresholds = await this.fraudRuleRepository.getThresholdConfig();

    const loader = new RuleLoader();
    const ruleInstances = await loader.load(rules);
    const chain = new RuleChain(ruleInstances);

    const decisionResult = await this.fraudDecisionService.decide(
      chain,
      {
        transactionId: "pending",
        userId: input.userId,
        amount: input.amount,
        timestamp: input.occurredAt,
        location:
          input.latitude !== undefined && input.longitude !== undefined
            ? { lat: input.latitude, lon: input.longitude }
            : undefined,
        deviceFingerprint: input.deviceFingerprint,
        metadata: {
          velocity: {
            count1s: 1,
            count1m: 1,
            count1h: 1,
            count24h: 1
          }
        }
      },
      profile,
      thresholds
    );

    const saved = await this.transactionRepository.save({
      ...input,
      idempotencyHash,
      riskScore: decisionResult.score,
      decision:
        decisionResult.decision === "BLOCK"
          ? "BLOCKED"
          : decisionResult.decision === "REVIEW"
            ? "REVIEW"
            : "APPROVED"
    });

    return {
      transaction: saved,
      wasCreated: true
    };
  }
}
