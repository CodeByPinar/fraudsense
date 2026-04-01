import { MAX_RISK_SCORE, MIN_RISK_SCORE } from "../../../../shared/constants/risk.js";
import type { RuleEvaluationResult } from "../../domain/types.js";

export class BayesianScorer {
  /**
   * Produces normalized risk score using weighted Bayesian-like aggregation.
   */
  public calculateScore(
    evaluations: RuleEvaluationResult[],
    multiTriggerBoost: number
  ): number {
    const triggered = evaluations.filter((result) => result.triggered);
    if (triggered.length === 0) {
      return MIN_RISK_SCORE;
    }

    const weightedSum = triggered.reduce((acc, result) => {
      return acc + result.weightedScore;
    }, 0);

    const normalized = 1 - Math.exp(-(weightedSum / MAX_RISK_SCORE));
    const boosted =
      triggered.length >= 2 ? normalized * (1 + multiTriggerBoost) : normalized;

    const finalScore = Math.round(Math.min(1, boosted) * MAX_RISK_SCORE);
    return Math.max(MIN_RISK_SCORE, Math.min(MAX_RISK_SCORE, finalScore));
  }
}
