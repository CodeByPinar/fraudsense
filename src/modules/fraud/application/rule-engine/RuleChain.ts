import type { BaseRule } from "../../domain/rules/BaseRule.js";
import type {
  RuleEvaluationResult,
  TransactionContext,
  UserRiskProfile
} from "../../domain/types.js";

export class RuleChain {
  public constructor(private readonly rules: BaseRule[]) {}

  /**
   * Executes rules sequentially and supports early exit when risk threshold is met.
   */
  public async evaluate(
    context: TransactionContext,
    profile: UserRiskProfile,
    earlyExitScore: number
  ): Promise<RuleEvaluationResult[]> {
    const evaluations: RuleEvaluationResult[] = [];

    for (const rule of this.rules) {
      const result = await rule.evaluate(context, profile);
      evaluations.push(result);

      const currentScore = evaluations.reduce((sum, item) => {
        if (!item.triggered) {
          return sum;
        }
        return sum + item.weightedScore;
      }, 0);

      if (currentScore >= earlyExitScore) {
        break;
      }
    }

    return evaluations;
  }
}
