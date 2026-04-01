import { BaseRule } from "../BaseRule.js";
import type {
  RuleConfigRecord,
  RuleEvaluationResult,
  TransactionContext,
  UserRiskProfile
} from "../../types.js";

export class AmountRule extends BaseRule {
  public async evaluate(
    context: TransactionContext,
    profile: UserRiskProfile
  ): Promise<RuleEvaluationResult> {
    const sigma = profile.stdDeviationAmount || 1;
    const zScore = Math.abs((context.amount - profile.meanAmount) / sigma);
    const threshold = Number((this.conditions as Record<string, unknown>).zScoreThreshold ?? 3);
    const triggered = zScore >= threshold;

    return {
      rule: this.name,
      triggered,
      weightedScore: triggered ? this.weight : 0,
      reason: triggered ? "Amount anomaly beyond user-specific z-score" : undefined,
      details: {
        zScore,
        threshold
      }
    };
  }
}

export function createRule(config: RuleConfigRecord): BaseRule {
  return new AmountRule(config);
}
