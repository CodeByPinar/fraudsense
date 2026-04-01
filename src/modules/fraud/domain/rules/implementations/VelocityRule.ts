import { BaseRule } from "../BaseRule.js";
import type {
  RuleConfigRecord,
  RuleEvaluationResult,
  TransactionContext,
  UserRiskProfile
} from "../../types.js";

type WindowMetrics = {
  count1s: number;
  count1m: number;
  count1h: number;
  count24h: number;
};

function readWindowMetrics(metadata?: Record<string, unknown>): WindowMetrics {
  const metrics = (metadata?.velocity as Partial<WindowMetrics> | undefined) ?? {};
  return {
    count1s: metrics.count1s ?? 0,
    count1m: metrics.count1m ?? 0,
    count1h: metrics.count1h ?? 0,
    count24h: metrics.count24h ?? 0
  };
}

export class VelocityRule extends BaseRule {
  public async evaluate(
    context: TransactionContext,
    _profile: UserRiskProfile
  ): Promise<RuleEvaluationResult> {
    const metrics = readWindowMetrics(context.metadata);
    const c = this.conditions as Record<string, number>;

    const triggered =
      metrics.count1s >= (c.threshold1s ?? Number.MAX_SAFE_INTEGER) ||
      metrics.count1m >= (c.threshold1m ?? Number.MAX_SAFE_INTEGER) ||
      metrics.count1h >= (c.threshold1h ?? Number.MAX_SAFE_INTEGER) ||
      metrics.count24h >= (c.threshold24h ?? Number.MAX_SAFE_INTEGER);

    return {
      rule: this.name,
      triggered,
      weightedScore: triggered ? this.weight : 0,
      reason: triggered ? "Velocity thresholds exceeded" : undefined,
      details: metrics
    };
  }
}

export function createRule(config: RuleConfigRecord): BaseRule {
  return new VelocityRule(config);
}
