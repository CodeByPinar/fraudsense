import { BaseRule } from "../BaseRule.js";
import type {
  RuleConfigRecord,
  RuleEvaluationResult,
  TransactionContext,
  UserRiskProfile
} from "../../types.js";

export class TimeRule extends BaseRule {
  public async evaluate(
    context: TransactionContext,
    profile: UserRiskProfile
  ): Promise<RuleEvaluationResult> {
    const txHour = context.timestamp.getUTCHours();
    const sigma = profile.usualHourStdDeviation || 1;
    const gaussianDistance = Math.abs((txHour - profile.usualHourMean) / sigma);
    const threshold = Number((this.conditions as Record<string, unknown>).gaussianThreshold ?? 3);

    const triggered = gaussianDistance >= threshold;

    return {
      rule: this.name,
      triggered,
      weightedScore: triggered ? this.weight : 0,
      reason: triggered ? "Transaction happened outside usual time profile" : undefined,
      details: {
        txHour,
        gaussianDistance,
        threshold
      }
    };
  }
}

export function createRule(config: RuleConfigRecord): BaseRule {
  return new TimeRule(config);
}
